
-- Add email column to link tester account
ALTER TABLE public.strava_testers 
ADD COLUMN tester_email TEXT;

-- Add unique constraint on email to prevent duplicates
CREATE UNIQUE INDEX strava_testers_email_unique ON public.strava_testers(tester_email) WHERE tester_email IS NOT NULL;
