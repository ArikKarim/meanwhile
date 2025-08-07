-- Update profiles table to support custom authentication
-- Add missing fields for firstName, lastName, and password

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Update the profiles table to make these fields required for new records
-- (existing records can have NULL values during migration)

-- Add an index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Add an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Add a comment to document the table
COMMENT ON TABLE public.profiles IS 'User profiles with custom authentication (username/password)';
