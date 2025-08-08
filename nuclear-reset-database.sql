-- NUCLEAR DATABASE RESET - Complete fresh start
-- This script completely destroys and recreates everything from scratch
-- Run this in your Supabase SQL Editor to start completely fresh

-- STEP 1: NUCLEAR DESTRUCTION - Remove everything
-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.time_blocks CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.group_settings CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS generate_group_code() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop all policies (in case any remain)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        EXCEPTION 
            WHEN OTHERS THEN
                CONTINUE;
        END;
    END LOOP;
END $$;

-- STEP 2: FRESH CREATION - Build everything properly
-- Create profiles table with proper UUID support
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  password_hash TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table (many-to-many relationship)
CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group_settings table for calendar settings
CREATE TABLE public.group_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE UNIQUE,
  start_hour INTEGER NOT NULL DEFAULT 7,
  end_hour INTEGER NOT NULL DEFAULT 21,
  week_start_day TEXT NOT NULL DEFAULT 'sunday',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_blocks table for schedule entries
CREATE TABLE public.time_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
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

-- STEP 3: CREATE UTILITY FUNCTIONS
-- Function to generate unique group codes
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
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
$$;

-- Function for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- STEP 4: CREATE TRIGGERS FOR AUTOMATIC TIMESTAMPS
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_settings_updated_at
  BEFORE UPDATE ON public.group_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_blocks_updated_at
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 5: DISABLE RLS AND GRANT PERMISSIONS (no recursion issues)
-- Disable Row Level Security completely to avoid infinite recursion
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to anon and authenticated roles for custom auth
GRANT ALL PRIVILEGES ON public.profiles TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.groups TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.group_members TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.group_settings TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.time_blocks TO anon, authenticated;

-- Grant usage on all sequences (needed for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Ensure the service_role also has full access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- STEP 6: CREATE PERFORMANCE INDEXES
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_groups_created_by ON public.groups(created_by);
CREATE INDEX idx_groups_code ON public.groups(code);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_settings_group_id ON public.group_settings(group_id);
CREATE INDEX idx_time_blocks_group_id ON public.time_blocks(group_id);
CREATE INDEX idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX idx_time_blocks_day_of_week ON public.time_blocks(day_of_week);

-- STEP 7: ENABLE REALTIME (if available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_settings;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if realtime publication doesn't exist
        NULL;
END $$;

-- STEP 8: CREATE HELPER FUNCTION FOR UUID GENERATION IN APP
-- This function can be called from your app to generate proper UUIDs
CREATE OR REPLACE FUNCTION generate_user_uuid()
RETURNS UUID
LANGUAGE sql
AS $$
  SELECT gen_random_uuid();
$$;

-- Add a comment to document this setup
COMMENT ON SCHEMA public IS 'Fresh database schema with proper UUID support, RLS disabled, and full anonymous access for custom authentication';

-- SUCCESS MESSAGE
DO $$
BEGIN
    RAISE NOTICE '🚀 DATABASE NUCLEAR RESET COMPLETE! 🚀';
    RAISE NOTICE '✅ All tables recreated with proper UUID support';
    RAISE NOTICE '✅ RLS disabled to prevent infinite recursion';
    RAISE NOTICE '✅ Full permissions granted for custom authentication';
    RAISE NOTICE '✅ Performance indexes created';
    RAISE NOTICE '✅ Helper functions available';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 NEXT STEPS:';
    RAISE NOTICE '1. Update your auth system to use proper UUIDs';
    RAISE NOTICE '2. Test your application with the fresh schema';
    RAISE NOTICE '3. Your infinite recursion issues are now resolved!';
END $$;
