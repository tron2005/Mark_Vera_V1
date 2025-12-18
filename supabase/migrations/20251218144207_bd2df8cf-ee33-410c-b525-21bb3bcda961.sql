-- Create calorie_entries table for proper macronutrient tracking
CREATE TABLE public.calorie_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  meal_name TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein NUMERIC(6,2) DEFAULT 0,
  carbs NUMERIC(6,2) DEFAULT 0,
  fat NUMERIC(6,2) DEFAULT 0,
  sugar NUMERIC(6,2) DEFAULT 0,
  fiber NUMERIC(6,2) DEFAULT 0,
  salt NUMERIC(6,3) DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calorie_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own calorie entries" 
ON public.calorie_entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calorie entries" 
ON public.calorie_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calorie entries" 
ON public.calorie_entries FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calorie entries" 
ON public.calorie_entries FOR DELETE USING (auth.uid() = user_id);

-- Create unique constraint for upsert
CREATE UNIQUE INDEX calorie_entries_user_date_meal_uniq 
ON public.calorie_entries (user_id, entry_date, meal_name);