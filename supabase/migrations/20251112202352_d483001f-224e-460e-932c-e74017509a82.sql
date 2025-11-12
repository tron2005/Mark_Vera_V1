-- Rozšíření profiles tabulky o fitness data a OAuth tokeny
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS height_cm INTEGER,
ADD COLUMN IF NOT EXISTS bmi DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS garmin_access_token TEXT,
ADD COLUMN IF NOT EXISTS garmin_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS garmin_token_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS strava_token_expiry TIMESTAMP WITH TIME ZONE;

-- Tabulka pro zdravotní logy (bolesti, únava, poznámky)
CREATE TABLE IF NOT EXISTS public.health_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  condition_type TEXT NOT NULL, -- 'knee_pain', 'fatigue', 'injury', 'general'
  severity INTEGER CHECK (severity BETWEEN 1 AND 10),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health logs"
ON public.health_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health logs"
ON public.health_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health logs"
ON public.health_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own health logs"
ON public.health_logs FOR DELETE
USING (auth.uid() = user_id);

-- Tabulka pro závodní cíle
CREATE TABLE IF NOT EXISTS public.race_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_name TEXT NOT NULL,
  race_date TIMESTAMP WITH TIME ZONE NOT NULL,
  race_type TEXT NOT NULL, -- 'marathon', 'half_marathon', '10k', '5k', 'trail', 'triathlon'
  target_time TEXT,
  preparation_plan TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.race_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own race goals"
ON public.race_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own race goals"
ON public.race_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own race goals"
ON public.race_goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own race goals"
ON public.race_goals FOR DELETE
USING (auth.uid() = user_id);

-- Trigger pro automatickou aktualizaci updated_at
CREATE TRIGGER update_race_goals_updated_at
BEFORE UPDATE ON public.race_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();