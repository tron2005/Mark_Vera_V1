-- Create daily_activity table for steps and calories from RingConn
CREATE TABLE public.daily_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  steps INTEGER,
  calories INTEGER,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, source)
);

-- Enable RLS
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own daily activity" 
ON public.daily_activity FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily activity" 
ON public.daily_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily activity" 
ON public.daily_activity FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily activity" 
ON public.daily_activity FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_daily_activity_user_date ON public.daily_activity(user_id, date);