-- Create table for Garmin activities
CREATE TABLE IF NOT EXISTS public.garmin_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  distance_km NUMERIC,
  duration_seconds INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  calories INTEGER,
  elevation_gain NUMERIC,
  avg_speed_kmh NUMERIC,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own Garmin activities" 
ON public.garmin_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Garmin activities" 
ON public.garmin_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Garmin activities" 
ON public.garmin_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Garmin activities" 
ON public.garmin_activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_garmin_activities_user_id ON public.garmin_activities(user_id);
CREATE INDEX idx_garmin_activities_start_date ON public.garmin_activities(start_date DESC);