-- Add missing RPC function for automatic color assignment
-- This function assigns a unique color to a user in a group automatically

CREATE OR REPLACE FUNCTION public.assign_user_color_in_group(
  p_user_id uuid,
  p_group_id uuid
) RETURNS text AS $$
DECLARE
  v_color text;
  v_colors text[] := ARRAY[
    '#3b82f6', -- Blue
    '#ef4444', -- Red  
    '#10b981', -- Green
    '#f59e0b', -- Amber
    '#8b5cf6', -- Purple
    '#ec4899', -- Pink
    '#06b6d4', -- Cyan
    '#84cc16', -- Lime
    '#f97316', -- Orange
    '#6366f1', -- Indigo
    '#14b8a6', -- Teal
    '#f43f5e'  -- Rose
  ];
  v_taken_colors text[];
  v_available_colors text[];
  v_exists int;
BEGIN
  -- Check if user is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'not_group_member';
  END IF;

  -- Check if user already has a color in this group
  SELECT color INTO v_color
  FROM public.user_group_colors
  WHERE user_id = p_user_id AND group_id = p_group_id;
  
  IF v_color IS NOT NULL THEN
    RETURN v_color;
  END IF;

  -- Get all colors currently taken in this group
  SELECT ARRAY_AGG(lower(color)) INTO v_taken_colors
  FROM public.user_group_colors
  WHERE group_id = p_group_id;
  
  IF v_taken_colors IS NULL THEN
    v_taken_colors := ARRAY[]::text[];
  END IF;

  -- Find available colors
  SELECT ARRAY_AGG(c) INTO v_available_colors
  FROM unnest(v_colors) AS c
  WHERE lower(c) <> ALL(v_taken_colors);

  -- If we have available colors, pick the first one
  IF array_length(v_available_colors, 1) > 0 THEN
    v_color := v_available_colors[1];
  ELSE
    -- All predefined colors are taken, generate a hash-based color
    -- Use a simple hash of user_id + group_id to generate a consistent color
    v_color := '#' || substr(md5(p_user_id::text || p_group_id::text), 1, 6);
  END IF;

  -- Insert the color using the existing set_user_color function
  BEGIN
    SELECT public.set_user_color(p_user_id, p_group_id, v_color) INTO v_color;
    RETURN v_color;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback: if the color is taken (race condition), try a hash-based color
      v_color := '#' || substr(md5(p_user_id::text || p_group_id::text), 1, 6);
      SELECT public.set_user_color(p_user_id, p_group_id, v_color) INTO v_color;
      RETURN v_color;
  END;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.assign_user_color_in_group(uuid, uuid) TO anon, authenticated;

-- Add a helpful comment
COMMENT ON FUNCTION public.assign_user_color_in_group IS 'Automatically assigns a unique color to a user in a group. Returns existing color if already assigned.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added assign_user_color_in_group function successfully!';
  RAISE NOTICE '🎨 Function will automatically assign unique colors to users in groups';
END $$;
