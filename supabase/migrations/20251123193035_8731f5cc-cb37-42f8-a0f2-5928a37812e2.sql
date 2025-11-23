-- Create table for Les Mills BodyCombat workouts
CREATE TABLE IF NOT EXISTS public.bodycombat_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workout_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  track_number TEXT,
  intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
  calories_estimate INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bodycombat_workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own BodyCombat workouts"
  ON public.bodycombat_workouts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own BodyCombat workouts"
  ON public.bodycombat_workouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own BodyCombat workouts"
  ON public.bodycombat_workouts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own BodyCombat workouts"
  ON public.bodycombat_workouts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_bodycombat_workouts_updated_at
  BEFORE UPDATE ON public.bodycombat_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();