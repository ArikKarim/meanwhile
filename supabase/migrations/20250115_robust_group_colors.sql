-- Remove the old color column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS color;

-- Create the user_group_colors table with proper constraints
CREATE TABLE IF NOT EXISTS public.user_group_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'), -- Ensure valid hex color
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id), -- One color per user per group
  UNIQUE(group_id, color) -- No duplicate colors within a group
);

-- Add foreign key constraint for user_id (referencing auth.users if needed)
-- ALTER TABLE public.user_group_colors ADD CONSTRAINT fk_user_group_colors_user_id 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.user_group_colors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_group_colors
CREATE POLICY "Users can view colors in groups they belong to" 
ON public.user_group_colors 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = user_group_colors.group_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their own group colors" 
ON public.user_group_colors 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_group_colors_updated_at
  BEFORE UPDATE ON public.user_group_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's most recent color
CREATE OR REPLACE FUNCTION get_user_most_recent_color(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  recent_color TEXT;
BEGIN
  SELECT color INTO recent_color
  FROM public.user_group_colors
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  RETURN recent_color;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign color to user in group
CREATE OR REPLACE FUNCTION assign_user_color_in_group(
  p_user_id UUID,
  p_group_id UUID,
  p_preferred_color TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  assigned_color TEXT;
  default_colors TEXT[] := ARRAY['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
  used_colors TEXT[];
  color_to_try TEXT;
  i INTEGER;
BEGIN
  -- Get all colors already used in this group
  SELECT ARRAY_AGG(color) INTO used_colors
  FROM public.user_group_colors
  WHERE group_id = p_group_id;
  
  -- If no colors used yet, initialize as empty array
  IF used_colors IS NULL THEN
    used_colors := ARRAY[]::TEXT[];
  END IF;
  
  -- Try preferred color first (from most recent group)
  IF p_preferred_color IS NOT NULL AND NOT (p_preferred_color = ANY(used_colors)) THEN
    assigned_color := p_preferred_color;
  ELSE
    -- Try default colors in order
    FOR i IN 1..array_length(default_colors, 1) LOOP
      color_to_try := default_colors[i];
      IF NOT (color_to_try = ANY(used_colors)) THEN
        assigned_color := color_to_try;
        EXIT;
      END IF;
    END LOOP;
    
    -- If all default colors are taken, generate a random one
    IF assigned_color IS NULL THEN
      -- Generate random color that's not taken
      FOR i IN 1..100 LOOP -- Limit attempts to prevent infinite loop
        assigned_color := '#' || lpad(to_hex((random() * 16777215)::int), 6, '0');
        IF NOT (assigned_color = ANY(used_colors)) THEN
          EXIT;
        END IF;
      END LOOP;
      
      -- Fallback if we somehow couldn't find a unique color
      IF assigned_color IS NULL OR (assigned_color = ANY(used_colors)) THEN
        assigned_color := '#' || lpad(to_hex((random() * 16777215)::int), 6, '0');
      END IF;
    END IF;
  END IF;
  
  -- Insert or update the color assignment
  INSERT INTO public.user_group_colors (user_id, group_id, color)
  VALUES (p_user_id, p_group_id, assigned_color)
  ON CONFLICT (user_id, group_id) 
  DO UPDATE SET color = assigned_color, updated_at = now();
  
  RETURN assigned_color;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle new group member color assignment
CREATE OR REPLACE FUNCTION handle_new_group_member()
RETURNS TRIGGER AS $$
DECLARE
  recent_color TEXT;
  assigned_color TEXT;
BEGIN
  -- Get user's most recent color from other groups
  recent_color := get_user_most_recent_color(NEW.user_id);
  
  -- Assign color to the user in this group
  assigned_color := assign_user_color_in_group(NEW.user_id, NEW.group_id, recent_color);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-assign colors when users join groups
CREATE TRIGGER trigger_assign_color_on_group_join
  AFTER INSERT ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_group_member();

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_group_colors;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_group_colors TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
