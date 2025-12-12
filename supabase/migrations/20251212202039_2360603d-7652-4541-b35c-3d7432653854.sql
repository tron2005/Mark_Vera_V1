
-- Create table for Strava tester configurations
CREATE TABLE public.strava_testers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  tester_name TEXT NOT NULL,
  strava_client_id TEXT,
  strava_client_secret TEXT,
  strava_refresh_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strava_testers ENABLE ROW LEVEL SECURITY;

-- RLS policies - only owner can manage their testers
CREATE POLICY "Users can view their own testers" 
ON public.strava_testers 
FOR SELECT 
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own testers" 
ON public.strava_testers 
FOR INSERT 
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own testers" 
ON public.strava_testers 
FOR UPDATE 
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own testers" 
ON public.strava_testers 
FOR DELETE 
USING (auth.uid() = owner_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_strava_testers_updated_at
BEFORE UPDATE ON public.strava_testers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
