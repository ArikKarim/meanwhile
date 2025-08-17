-- Overhaul group color system: normalize colors, enforce uniqueness per group (case-insensitive),
-- sync username, and provide an atomic RPC to set a user's color.

-- Ensure extension for UUID generation (if used elsewhere)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Normalize color to lowercase and sync username on write
CREATE OR REPLACE FUNCTION public.fn_user_group_colors_normalize()
RETURNS trigger AS $$
DECLARE
  v_username text;
BEGIN
  -- Normalize color to lowercase
  IF NEW.color IS NOT NULL THEN
    NEW.color := lower(NEW.color);
  END IF;

  -- Sync username from profiles table if present
  SELECT username INTO v_username
  FROM public.profiles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_username IS NULL THEN
    v_username := 'Unknown User';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_group_colors' AND column_name = 'user_name'
  ) THEN
    NEW.user_name := v_username;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- Create trigger if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_user_group_colors_normalize'
      AND n.nspname = 'public'
      AND c.relname = 'user_group_colors'
  ) THEN
    CREATE TRIGGER trg_user_group_colors_normalize
      BEFORE INSERT OR UPDATE ON public.user_group_colors
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_user_group_colors_normalize();
  END IF;
END $$;

-- Add hex color format check (case-insensitive), if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_user_group_colors_hex'
  ) THEN
    ALTER TABLE public.user_group_colors
    ADD CONSTRAINT chk_user_group_colors_hex
    CHECK (color ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;

-- Replace existing unique constraint on (group_id, color) with case-insensitive unique index
DO $$
BEGIN
  -- Drop old unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_group_colors'::regclass
      AND contype = 'u'
      AND conname = 'user_group_colors_group_id_color_key'
  ) THEN
    ALTER TABLE public.user_group_colors DROP CONSTRAINT user_group_colors_group_id_color_key;
  END IF;

  -- Create case-insensitive unique index (group_id, lower(color)) if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'uq_user_group_colors_group_color_ci'
  ) THEN
    CREATE UNIQUE INDEX uq_user_group_colors_group_color_ci
    ON public.user_group_colors (group_id, lower(color));
  END IF;
END $$;

-- Atomic RPC to set a user's color with uniqueness check and normalization
CREATE OR REPLACE FUNCTION public.set_user_color(
  p_user_id uuid,
  p_group_id uuid,
  p_color text
) RETURNS text AS $$
DECLARE
  v_color text;
  v_exists int;
BEGIN
  -- Normalize
  v_color := lower(p_color);

  -- Enforce membership: allow only group members to set (RLS also applies)
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not_group_member';
  END IF;

  -- Uniqueness within group (case-insensitive)
  SELECT 1 INTO v_exists
  FROM public.user_group_colors
  WHERE group_id = p_group_id AND lower(color) = v_color AND user_id <> p_user_id
  LIMIT 1;

  IF v_exists = 1 THEN
    RAISE EXCEPTION 'color_taken';
  END IF;

  -- Upsert the color; triggers will handle username and normalization
  INSERT INTO public.user_group_colors AS ugc (user_id, group_id, color)
  VALUES (p_user_id, p_group_id, v_color)
  ON CONFLICT (user_id, group_id)
  DO UPDATE SET color = EXCLUDED.color, updated_at = now();

  RETURN v_color;
END;
$$ LANGUAGE plpgsql;

-- Ensure realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'user_group_colors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_group_colors;
  END IF;
END $$;

-- RLS: keep existing policies; ensure SELECT visible to group members, and users manage their own rows
-- (Assumes policies already exist; otherwise, uncomment below)
-- ALTER TABLE public.user_group_colors ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view colors in groups they belong to"
--   ON public.user_group_colors FOR SELECT USING (
--     EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = user_group_colors.group_id AND gm.user_id = auth.uid())
--   );
-- CREATE POLICY "Users can manage their own group colors"
--   ON public.user_group_colors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update their own group colors"
--   ON public.user_group_colors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


