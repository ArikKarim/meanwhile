-- CONSOLIDATED DATABASE SCHEMA
-- This migration represents the final state of all previous migrations
-- Run this on a fresh database to set up the complete schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create time_blocks table for schedule entries
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  tag TEXT DEFAULT 'class',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_group_colors table for group-specific user colors
CREATE TABLE IF NOT EXISTS public.user_group_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_code ON public.groups(code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_group_id ON public.time_blocks(group_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_day_of_week ON public.time_blocks(day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_group_colors_group_id ON public.user_group_colors(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_colors_user_id ON public.user_group_colors(user_id);

-- Create utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Color management functions
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
  
  NEW.user_name := v_username;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atomic RPC to set a user's color with uniqueness check
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

  -- Enforce membership: allow only group members to set
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

  -- Upsert the color
  INSERT INTO public.user_group_colors AS ugc (user_id, group_id, color)
  VALUES (p_user_id, p_group_id, v_color)
  ON CONFLICT (user_id, group_id)
  DO UPDATE SET color = EXCLUDED.color, updated_at = now();

  RETURN v_color;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_groups_updated_at') THEN
    CREATE TRIGGER update_groups_updated_at
      BEFORE UPDATE ON public.groups
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_time_blocks_updated_at') THEN
    CREATE TRIGGER update_time_blocks_updated_at
      BEFORE UPDATE ON public.time_blocks
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_group_colors_updated_at') THEN
    CREATE TRIGGER update_user_group_colors_updated_at
      BEFORE UPDATE ON public.user_group_colors
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_group_colors_normalize') THEN
    CREATE TRIGGER trg_user_group_colors_normalize
      BEFORE INSERT OR UPDATE ON public.user_group_colors
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_user_group_colors_normalize();
  END IF;
END $$;

-- Add constraints
DO $$
BEGIN
  -- Add hex color format check (case-insensitive)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_user_group_colors_hex'
  ) THEN
    ALTER TABLE public.user_group_colors
    ADD CONSTRAINT chk_user_group_colors_hex
    CHECK (color ~* '^#[0-9a-f]{6}$');
  END IF;

  -- Create case-insensitive unique index for group colors
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'uq_user_group_colors_group_color_ci'
  ) THEN
    CREATE UNIQUE INDEX uq_user_group_colors_group_color_ci
    ON public.user_group_colors (group_id, lower(color));
  END IF;
END $$;

-- Disable RLS for anonymous access (custom auth system)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_colors DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anonymous role for custom auth
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.groups TO anon;
GRANT ALL ON public.group_members TO anon;
GRANT ALL ON public.time_blocks TO anon;
GRANT ALL ON public.user_group_colors TO anon;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant permissions to authenticated role as well
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.groups TO authenticated;
GRANT ALL ON public.group_members TO authenticated;
GRANT ALL ON public.time_blocks TO authenticated;
GRANT ALL ON public.user_group_colors TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable realtime for all tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Remove tables first to avoid conflicts
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.profiles;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.groups;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.group_members;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.time_blocks;
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.user_group_colors;
    
    -- Add tables
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_group_colors;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if realtime publication doesn't exist
    NULL;
END $$;

-- Add helpful comment
COMMENT ON SCHEMA public IS 'Meanwhile app schema with custom authentication, group-based scheduling, and user color management';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Consolidated schema migration completed successfully!';
  RAISE NOTICE '📋 Tables created: profiles, groups, group_members, time_blocks, user_group_colors';
  RAISE NOTICE '🔧 Functions created: update_updated_at_column, generate_group_code, set_user_color';
  RAISE NOTICE '⚡ Triggers and indexes created for optimal performance';
  RAISE NOTICE '🔓 RLS disabled for custom authentication system';
END $$;
