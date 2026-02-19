-- Create strava_activities table to cache Strava data locally
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  activity_type text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  distance_meters numeric,
  moving_time_seconds integer,
  elapsed_time_seconds integer,
  total_elevation_gain numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate integer,
  max_heartrate integer,
  calories numeric,
  average_watts numeric,
  max_watts numeric,
  suffer_score integer,
  raw_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_strava_activity_per_user UNIQUE (user_id, id)
);

-- Enable RLS
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own Strava activities"
  ON public.strava_activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava activities"
  ON public.strava_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava activities"
  ON public.strava_activities
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava activities"
  ON public.strava_activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_strava_activities_user_date ON public.strava_activities(user_id, start_date DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_strava_activities_updated_at
  BEFORE UPDATE ON public.strava_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track last sync time
CREATE TABLE IF NOT EXISTS public.strava_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  last_sync_at timestamp with time zone NOT NULL DEFAULT now(),
  activities_synced integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.strava_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync log"
  ON public.strava_sync_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync log"
  ON public.strava_sync_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync log"
  ON public.strava_sync_log
  FOR UPDATE
  USING (auth.uid() = user_id);