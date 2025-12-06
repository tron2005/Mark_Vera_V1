import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Target, TrendingDown, Calendar, Thermometer, Plus, X } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { cs } from 'date-fns/locale';

interface WeightLossPlan {
  id: string;
  start_weight_kg: number;
  target_weight_kg: number;
  start_date: string;
  target_date: string;
  weekly_loss_kg: number;
  is_active: boolean;
}

interface PausePeriod {
  id: string;
  pause_date: string;
  reason: string;
}

export const WeightLossPlan = () => {
  const [plan, setPlan] = useState<WeightLossPlan | null>(null);
  const [pauses, setPauses] = useState<PausePeriod[]>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    start_weight_kg: '',
    target_weight_kg: '',
    target_date: '',
    weekly_loss_kg: '0.5'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load active plan
      const { data: planData } = await supabase
        .from('weight_loss_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (planData) {
        setPlan(planData);
        
        // Load pauses
        const { data: pauseData } = await supabase
          .from('weight_plan_pauses')
          .select('*')
          .eq('plan_id', planData.id)
          .order('pause_date', { ascending: false });
        
        setPauses(pauseData || []);
      }

      // Load current weight from body_composition
      const { data: weightData } = await supabase
        .from('body_composition')
        .select('weight_kg, date')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (weightData) {
        setCurrentWeight(Number(weightData.weight_kg));
      }
    } catch (error) {
      console.error('Error loading weight loss plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startWeight = parseFloat(formData.start_weight_kg) || currentWeight || 0;

      const { error } = await supabase
        .from('weight_loss_plans')
        .insert({
          user_id: user.id,
          start_weight_kg: startWeight,
          target_weight_kg: parseFloat(formData.target_weight_kg),
          target_date: formData.target_date,
          weekly_loss_kg: parseFloat(formData.weekly_loss_kg)
        });

      if (error) throw error;
      
      toast.success('Plán hubnutí vytvořen!');
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error('Error creating plan:', error);
      toast.error('Chyba při vytváření plánu');
    }
  };

  const addIllnessDay = async () => {
    if (!plan) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Check if already added today
      const exists = pauses.some(p => p.pause_date === today);
      if (exists) {
        toast.info('Dnešek je již označen jako nemoc');
        return;
      }

      const { error } = await supabase
        .from('weight_plan_pauses')
        .insert({
          plan_id: plan.id,
          user_id: user.id,
          pause_date: today,
          reason: 'illness'
        });

      if (error) throw error;
      
      toast.success('Nemoc zaznamenána - cílový termín posunut');
      loadData();
    } catch (error) {
      console.error('Error adding illness day:', error);
      toast.error('Chyba při zaznamenávání nemoci');
    }
  };

  const deletePlan = async () => {
    if (!plan) return;
    
    try {
      const { error } = await supabase
        .from('weight_loss_plans')
        .delete()
        .eq('id', plan.id);

      if (error) throw error;
      
      toast.success('Plán smazán');
      setPlan(null);
      setPauses([]);
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Chyba při mazání plánu');
    }
  };

  const calculateProgress = () => {
    if (!plan || currentWeight === null) return null;

    const totalToLose = plan.start_weight_kg - plan.target_weight_kg;
    const actualLost = plan.start_weight_kg - currentWeight;
    const progressPercent = Math.min(100, Math.max(0, (actualLost / totalToLose) * 100));

    // Adjust target date by pause days
    const adjustedTargetDate = addDays(new Date(plan.target_date), pauses.length);
    const daysRemaining = differenceInDays(adjustedTargetDate, new Date());
    const weeksRemaining = Math.max(0, daysRemaining / 7);

    // Expected weight based on linear progress
    const daysSinceStart = differenceInDays(new Date(), new Date(plan.start_date));
    const effectiveDays = daysSinceStart - pauses.filter(p => 
      new Date(p.pause_date) >= new Date(plan.start_date)
    ).length;
    const expectedLoss = (effectiveDays / 7) * plan.weekly_loss_kg;
    const expectedWeight = plan.start_weight_kg - expectedLoss;

    const remainingToLose = currentWeight - plan.target_weight_kg;
    const requiredWeeklyLoss = weeksRemaining > 0 ? remainingToLose / weeksRemaining : 0;

    return {
      progressPercent,
      actualLost,
      remainingToLose,
      adjustedTargetDate,
      daysRemaining,
      expectedWeight,
      isAhead: currentWeight < expectedWeight,
      requiredWeeklyLoss
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Plán hubnutí
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit plán hubnutí
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Startovní váha (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder={currentWeight?.toString() || '80'}
                    value={formData.start_weight_kg}
                    onChange={(e) => setFormData({ ...formData, start_weight_kg: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cílová váha (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="75"
                    value={formData.target_weight_kg}
                    onChange={(e) => setFormData({ ...formData, target_weight_kg: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cílový termín</Label>
                  <Input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Týdenní úbytek (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.weekly_loss_kg}
                    onChange={(e) => setFormData({ ...formData, weekly_loss_kg: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={createPlan} className="flex-1">Vytvořit</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Zrušit</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const progress = calculateProgress();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Plán hubnutí
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={deletePlan}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{plan.start_weight_kg} kg</span>
            <span className="font-bold text-primary">{currentWeight?.toFixed(1) || '?'} kg</span>
            <span>{plan.target_weight_kg} kg</span>
          </div>
          <Progress value={progress?.progressPercent || 0} className="h-3" />
        </div>

        {/* Stats */}
        {progress && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span>Shozeno: <strong>{progress.actualLost.toFixed(1)} kg</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" />
              <span>Zbývá: <strong>{progress.remainingToLose.toFixed(1)} kg</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span>Termín: <strong>{format(progress.adjustedTargetDate, 'd.M.yyyy', { locale: cs })}</strong></span>
            </div>
            <div>
              {progress.isAhead ? (
                <Badge variant="default" className="bg-green-500">Předstihuješ!</Badge>
              ) : (
                <Badge variant="secondary">Potřeba: {progress.requiredWeeklyLoss.toFixed(2)} kg/týden</Badge>
              )}
            </div>
          </div>
        )}

        {/* Illness button */}
        <div className="pt-2 border-t">
          <Button variant="outline" size="sm" onClick={addIllnessDay} className="w-full">
            <Thermometer className="h-4 w-4 mr-2" />
            Označit dnešek jako nemoc ({pauses.length} dní)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
