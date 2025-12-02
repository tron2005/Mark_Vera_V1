-- Add source column to sleep_logs table
ALTER TABLE public.sleep_logs 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add source column to heart_rate_rest table
ALTER TABLE public.heart_rate_rest 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_sleep_logs_source ON public.sleep_logs(source);
CREATE INDEX IF NOT EXISTS idx_heart_rate_rest_source ON public.heart_rate_rest(source);