-- Fix RLS policies for user_group_colors table to allow users to manage their own colors

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view colors in groups they belong to" ON public.user_group_colors;
DROP POLICY IF EXISTS "Users can manage their own group colors" ON public.user_group_colors;
DROP POLICY IF EXISTS "Users can insert their own group colors" ON public.user_group_colors;
DROP POLICY IF EXISTS "Users can update their own group colors" ON public.user_group_colors;

-- Create comprehensive RLS policies that allow proper access

-- Allow users to view colors in groups they belong to
CREATE POLICY "view_group_colors" ON public.user_group_colors
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = user_group_colors.group_id 
    AND gm.user_id = auth.uid()
  )
);

-- Allow users to insert their own color records in groups they belong to
CREATE POLICY "insert_own_color" ON public.user_group_colors
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = user_group_colors.group_id 
    AND gm.user_id = auth.uid()
  )
);

-- Allow users to update their own color records
CREATE POLICY "update_own_color" ON public.user_group_colors
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = user_group_colors.group_id 
    AND gm.user_id = auth.uid()
  )
);

-- Allow users to delete their own color records (optional, for completeness)
CREATE POLICY "delete_own_color" ON public.user_group_colors
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.user_group_colors ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_colors TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
