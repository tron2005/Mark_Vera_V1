-- Create weight loss plan table
CREATE TABLE public.weight_loss_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_weight_kg NUMERIC NOT NULL,
  target_weight_kg NUMERIC NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  weekly_loss_kg NUMERIC DEFAULT 0.5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create illness/pause periods table
CREATE TABLE public.weight_plan_pauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.weight_loss_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pause_date DATE NOT NULL,
  reason TEXT DEFAULT 'illness',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_loss_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_plan_pauses ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_loss_plans
CREATE POLICY "Users can view own weight loss plans" ON public.weight_loss_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weight loss plans" ON public.weight_loss_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight loss plans" ON public.weight_loss_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight loss plans" ON public.weight_loss_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for weight_plan_pauses
CREATE POLICY "Users can view own pauses" ON public.weight_plan_pauses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pauses" ON public.weight_plan_pauses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pauses" ON public.weight_plan_pauses FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_weight_loss_plans_updated_at
  BEFORE UPDATE ON public.weight_loss_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();