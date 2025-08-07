-- Fix infinite recursion in RLS policies
-- This migration ensures RLS is completely disabled and handles any remaining policy conflicts

-- First, drop ALL existing policies to prevent recursion
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Ensure RLS is disabled on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to anon and authenticated roles
GRANT ALL PRIVILEGES ON public.profiles TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.groups TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.group_members TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.time_blocks TO anon, authenticated;

-- Grant usage on all sequences (needed for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Ensure the service_role also has full access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Add a comment to document this change
COMMENT ON SCHEMA public IS 'RLS disabled for custom authentication - full anonymous access granted';
