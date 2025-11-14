-- Vytvoření tabulky pro spánková data
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sleep_date date NOT NULL,
  start_time text,
  end_time text,
  duration_minutes integer,
  rem_duration_minutes integer,
  awake_duration_minutes integer,
  deep_sleep_minutes integer,
  light_sleep_minutes integer,
  unknown_sleep_minutes integer,
  hr_lowest integer,
  hr_average integer,
  respiration_rate numeric,
  quality integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Povolení RLS
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sleep logs"
  ON public.sleep_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sleep logs"
  ON public.sleep_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sleep logs"
  ON public.sleep_logs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sleep logs"
  ON public.sleep_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index pro rychlejší vyhledávání
CREATE INDEX idx_sleep_logs_user_date ON public.sleep_logs(user_id, sleep_date DESC);