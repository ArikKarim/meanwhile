-- Add missing columns to existing tables
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- Create a table for calendar settings (previously stored in localStorage)
CREATE TABLE IF NOT EXISTS public.group_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  start_hour INTEGER NOT NULL DEFAULT 7,
  end_hour INTEGER NOT NULL DEFAULT 21,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id)
);

-- Enable RLS for group_settings
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_settings
CREATE POLICY "Users can view group settings for groups they belong to" 
ON public.group_settings 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1 FROM group_members 
  WHERE group_members.group_id = group_settings.group_id 
  AND group_members.user_id = auth.uid()
));

CREATE POLICY "Group creators can insert group settings" 
ON public.group_settings 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM groups 
  WHERE groups.id = group_settings.group_id 
  AND groups.created_by = auth.uid()
));

CREATE POLICY "Group creators can update group settings" 
ON public.group_settings 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM groups 
  WHERE groups.id = group_settings.group_id 
  AND groups.created_by = auth.uid()
));

-- Update profiles policies to allow viewing other profiles in same groups
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view profiles of group members" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM group_members gm1, group_members gm2 
    WHERE gm1.user_id = auth.uid() 
    AND gm2.user_id = profiles.user_id 
    AND gm1.group_id = gm2.group_id
  )
);

-- Add trigger for group_settings updated_at
CREATE TRIGGER update_group_settings_updated_at
BEFORE UPDATE ON public.group_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for all tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.time_blocks REPLICA IDENTITY FULL;
ALTER TABLE public.group_settings REPLICA IDENTITY FULL;

-- Add group_settings to realtime publication (others may already be added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_settings;