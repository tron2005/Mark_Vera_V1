-- Tabulka pro individuální tréninkové plány
CREATE TABLE IF NOT EXISTS training_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  plan_data JSONB,           -- celá struktura plánu (fáze, tréninky, cviky)
  notes TEXT,                -- omezení, poznámky (zranění, preference)
  created_by_ai BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_plans_user_status_idx
  ON training_plans(user_id, status, created_at DESC);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own training plans"
  ON training_plans FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own training plans"
  ON training_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own training plans"
  ON training_plans FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own training plans"
  ON training_plans FOR DELETE USING (auth.uid() = user_id);
