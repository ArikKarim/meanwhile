-- Add user_name column to user_group_colors table
ALTER TABLE public.user_group_colors 
ADD COLUMN user_name TEXT;

-- Update existing records with user names from profiles
UPDATE public.user_group_colors 
SET user_name = profiles.username
FROM public.profiles 
WHERE user_group_colors.user_id = profiles.user_id;

-- Make user_name required for future inserts
ALTER TABLE public.user_group_colors 
ALTER COLUMN user_name SET NOT NULL;

-- Update the assign_user_color_in_group function to include user_name
CREATE OR REPLACE FUNCTION assign_user_color_in_group(
  p_user_id UUID,
  p_group_id UUID,
  p_preferred_color TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  assigned_color TEXT;
  user_name_value TEXT;
  default_colors TEXT[] := ARRAY['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
  used_colors TEXT[];
  color_to_try TEXT;
  i INTEGER;
BEGIN
  -- Get user name from profiles
  SELECT username INTO user_name_value
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- If no user name found, use a fallback
  IF user_name_value IS NULL THEN
    user_name_value := 'Unknown User';
  END IF;
  
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
  
  -- Insert or update the color assignment with user name
  INSERT INTO public.user_group_colors (user_id, group_id, color, user_name)
  VALUES (p_user_id, p_group_id, assigned_color, user_name_value)
  ON CONFLICT (user_id, group_id) 
  DO UPDATE SET 
    color = assigned_color, 
    user_name = user_name_value,
    updated_at = now();
  
  RETURN assigned_color;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger function to include user name
CREATE OR REPLACE FUNCTION handle_new_group_member()
RETURNS TRIGGER AS $$
DECLARE
  recent_color TEXT;
  assigned_color TEXT;
  user_name_value TEXT;
BEGIN
  -- Get user name from profiles
  SELECT username INTO user_name_value
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- If no user name found, use a fallback
  IF user_name_value IS NULL THEN
    user_name_value := 'Unknown User';
  END IF;
  
  -- Get user's most recent color from other groups
  recent_color := get_user_most_recent_color(NEW.user_id);
  
  -- Assign color to the user in this group
  assigned_color := assign_user_color_in_group(NEW.user_id, NEW.group_id, recent_color);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
