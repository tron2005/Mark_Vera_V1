-- Fix data types in strava_activities table to accept decimal numbers
-- Change integer fields that can have decimal values to numeric

ALTER TABLE strava_activities 
  ALTER COLUMN calories TYPE numeric USING calories::numeric,
  ALTER COLUMN elapsed_time_seconds TYPE numeric USING elapsed_time_seconds::numeric,
  ALTER COLUMN moving_time_seconds TYPE numeric USING moving_time_seconds::numeric;