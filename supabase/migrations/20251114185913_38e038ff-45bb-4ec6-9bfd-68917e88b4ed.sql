-- Odstranit duplikáty pomocí created_at (ponechat nejnovější)

-- Sleep logs
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, sleep_date ORDER BY created_at DESC) as rn
  FROM public.sleep_logs
)
DELETE FROM public.sleep_logs
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Heart rate rest
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date, COALESCE(time, '00:00:00') ORDER BY created_at DESC) as rn
  FROM public.heart_rate_rest
)
DELETE FROM public.heart_rate_rest
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- HRV logs
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date, COALESCE(time, '00:00:00') ORDER BY created_at DESC) as rn
  FROM public.hrv_logs
)
DELETE FROM public.hrv_logs
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Body composition
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date, COALESCE(time, '00:00:00') ORDER BY created_at DESC) as rn
  FROM public.body_composition
)
DELETE FROM public.body_composition
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Garmin activities
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, start_date ORDER BY created_at DESC) as rn
  FROM public.garmin_activities
)
DELETE FROM public.garmin_activities
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Nyní přidat unique constrainty
ALTER TABLE public.sleep_logs 
ADD CONSTRAINT sleep_logs_user_date_unique UNIQUE (user_id, sleep_date);

CREATE UNIQUE INDEX heart_rate_rest_user_date_time_unique 
ON public.heart_rate_rest (user_id, date, COALESCE(time, '00:00:00'));

CREATE UNIQUE INDEX hrv_logs_user_date_time_unique 
ON public.hrv_logs (user_id, date, COALESCE(time, '00:00:00'));

CREATE UNIQUE INDEX body_composition_user_date_time_unique 
ON public.body_composition (user_id, date, COALESCE(time, '00:00:00'));

ALTER TABLE public.garmin_activities 
ADD CONSTRAINT garmin_activities_user_start_date_unique UNIQUE (user_id, start_date);