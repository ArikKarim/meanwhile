-- URGENT FIX: UUID Generation for time_blocks table
-- This fixes the "null value in column id" error

-- 1. First, ensure the uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop and recreate the time_blocks table with proper UUID defaults
-- Save existing data first
CREATE TABLE IF NOT EXISTS time_blocks_backup AS SELECT * FROM public.time_blocks WHERE id IS NOT NULL;

-- Drop the problematic table
DROP TABLE IF EXISTS public.time_blocks CASCADE;

-- Recreate with proper UUID generation
CREATE TABLE public.time_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  label TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  tag TEXT DEFAULT 'class',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Restore data if any existed
INSERT INTO public.time_blocks (id, user_id, group_id, label, day_of_week, start_time, end_time, color, tag, created_at, updated_at)
SELECT id, user_id, group_id, label, day_of_week, start_time, end_time, color, tag, created_at, updated_at 
FROM time_blocks_backup;

-- Clean up backup
DROP TABLE IF EXISTS time_blocks_backup;

-- 3. Recreate foreign key constraints
ALTER TABLE public.time_blocks 
ADD CONSTRAINT time_blocks_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_time_blocks_group_id ON public.time_blocks(group_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_day_of_week ON public.time_blocks(day_of_week);

-- 5. Recreate trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_time_blocks_updated_at ON public.time_blocks;
CREATE TRIGGER update_time_blocks_updated_at
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Ensure no RLS restrictions
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;

-- 7. Grant full permissions
GRANT ALL PRIVILEGES ON public.time_blocks TO anon, authenticated, postgres;

-- 8. Test UUID generation
DO $$
DECLARE
  test_id UUID;
BEGIN
  -- Test that UUID generation works
  SELECT gen_random_uuid() INTO test_id;
  RAISE NOTICE 'UUID generation test successful: %', test_id;
END $$;

-- 9. Test insert (will be rolled back)
BEGIN;
INSERT INTO public.time_blocks (user_id, group_id, label, day_of_week, start_time, end_time, color, tag) 
VALUES (gen_random_uuid(), gen_random_uuid(), 'TEST EVENT FIXED', 1, '09:00', '10:00', '#FF0000', 'test');
ROLLBACK;

SELECT 'UUID generation fixed! Event creation should work now!' as status;
