-- Add trainer-related fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trainer_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS user_description text DEFAULT '';

-- Add comment for clarity
COMMENT ON COLUMN profiles.trainer_enabled IS 'Whether the AI fitness trainer is enabled for this user';
COMMENT ON COLUMN profiles.user_description IS 'User description for personalized AI responses (interests, family, work, etc.)';