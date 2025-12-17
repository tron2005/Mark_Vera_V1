-- Ensure upsert works for Runalyze/manual weight imports and in-app weight entry
-- We allow multiple measurements per day by including time in the unique key.
CREATE UNIQUE INDEX IF NOT EXISTS body_composition_user_date_time_uniq
ON public.body_composition (user_id, date, time);
