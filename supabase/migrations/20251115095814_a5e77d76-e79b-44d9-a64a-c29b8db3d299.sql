-- Allow fractional heart rate values from Strava
ALTER TABLE strava_activities 
  ALTER COLUMN average_heartrate TYPE numeric USING average_heartrate::numeric,
  ALTER COLUMN max_heartrate TYPE numeric USING max_heartrate::numeric;