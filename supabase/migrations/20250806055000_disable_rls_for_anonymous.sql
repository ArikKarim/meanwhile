-- Disable Row Level Security for anonymous access
-- Since we're removing authentication, we need to allow anonymous access to all tables

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.groups;

DROP POLICY IF EXISTS "Users can view group members of groups they belong to" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

DROP POLICY IF EXISTS "Users can view time blocks in groups they belong to" ON public.time_blocks;
DROP POLICY IF EXISTS "Users can create their own time blocks" ON public.time_blocks;
DROP POLICY IF EXISTS "Users can update their own time blocks" ON public.time_blocks;
DROP POLICY IF EXISTS "Users can delete their own time blocks" ON public.time_blocks;

-- Disable RLS entirely for all tables to allow anonymous access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to anonymous role
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.groups TO anon;
GRANT ALL ON public.group_members TO anon;
GRANT ALL ON public.time_blocks TO anon;

-- Grant usage on sequences for insert operations
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon; 