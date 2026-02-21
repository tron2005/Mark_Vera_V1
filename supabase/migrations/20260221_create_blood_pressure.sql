-- Tabulka pro záznamy krevního tlaku
CREATE TABLE IF NOT EXISTS blood_pressure (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  systolic INTEGER NOT NULL,        -- horní tlak (mmHg)
  diastolic INTEGER NOT NULL,       -- dolní tlak (mmHg)
  pulse INTEGER,                    -- tep při měření (bpm)
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,                        -- volitelná poznámka (ráno, po cvičení, ...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pro rychlé dotazy podle uživatele a data
CREATE INDEX IF NOT EXISTS blood_pressure_user_date_idx
  ON blood_pressure(user_id, measured_at DESC);

-- RLS
ALTER TABLE blood_pressure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own blood pressure"
  ON blood_pressure FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own blood pressure"
  ON blood_pressure FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own blood pressure"
  ON blood_pressure FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own blood pressure"
  ON blood_pressure FOR DELETE
  USING (auth.uid() = user_id);
