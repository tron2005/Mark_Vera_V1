-- Tabulka pro klidový tep
CREATE TABLE IF NOT EXISTS public.heart_rate_rest (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  heart_rate INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.heart_rate_rest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resting heart rate"
  ON public.heart_rate_rest FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resting heart rate"
  ON public.heart_rate_rest FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resting heart rate"
  ON public.heart_rate_rest FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resting heart rate"
  ON public.heart_rate_rest FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_heart_rate_rest_user_date ON public.heart_rate_rest(user_id, date DESC);

-- Tabulka pro HRV (variabilita srdeční frekvence)
CREATE TABLE IF NOT EXISTS public.hrv_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  hrv NUMERIC NOT NULL,
  metric TEXT,
  measurement_type TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hrv_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own HRV logs"
  ON public.hrv_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HRV logs"
  ON public.hrv_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own HRV logs"
  ON public.hrv_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own HRV logs"
  ON public.hrv_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_hrv_logs_user_date ON public.hrv_logs(user_id, date DESC);

-- Tabulka pro váhu a složení těla
CREATE TABLE IF NOT EXISTS public.body_composition (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  weight_kg NUMERIC NOT NULL,
  fat_percentage NUMERIC,
  water_percentage NUMERIC,
  muscle_percentage NUMERIC,
  bone_percentage NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.body_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own body composition"
  ON public.body_composition FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own body composition"
  ON public.body_composition FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own body composition"
  ON public.body_composition FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own body composition"
  ON public.body_composition FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_body_composition_user_date ON public.body_composition(user_id, date DESC);