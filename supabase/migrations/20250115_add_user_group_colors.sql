-- Create table for group-specific user colors
CREATE TABLE public.user_group_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

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

CREATE POLICY "Users can create their own group colors" 
ON public.user_group_colors 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own group colors" 
ON public.user_group_colors 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own group colors" 
ON public.user_group_colors 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_group_colors_updated_at
  BEFORE UPDATE ON public.user_group_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_group_colors;
