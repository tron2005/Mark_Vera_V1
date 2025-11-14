-- Add gender column to profiles table for BMR calculation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male';

COMMENT ON COLUMN public.profiles.gender IS 'User gender for BMR calculation (male/female)';