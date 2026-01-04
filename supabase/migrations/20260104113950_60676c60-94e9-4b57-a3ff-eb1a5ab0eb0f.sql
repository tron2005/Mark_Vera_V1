-- Add macronutrient daily goals to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS protein_goal_g numeric DEFAULT 120,
ADD COLUMN IF NOT EXISTS carbs_goal_g numeric DEFAULT 250,
ADD COLUMN IF NOT EXISTS fat_goal_g numeric DEFAULT 70;