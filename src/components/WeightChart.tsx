import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, Target, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

interface WeightPlan {
  start_weight_kg: number;
  target_weight_kg: number;
  start_date: string;
  target_date: string;
}

export const WeightChart = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeightPlan | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWeightData();
  }, []);

  const loadWeightData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [weightResult, planResult] = await Promise.all([
        supabase
          .from("body_composition")
          .select("date, weight_kg")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .limit(90),
        supabase
          .from("weight_loss_plans")
          .select("start_weight_kg, target_weight_kg, start_date, target_date")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle()
      ]);

      if (weightResult.error) throw weightResult.error;

      const activePlan = planResult.data;
      setPlan(activePlan);

      // Build chart data with actual weights
      const weightDataPoints = (weightResult.data || []).map((item: any) => {
        const dataPoint: any = {
          date: new Date(item.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }),
          fullDate: item.date,
          weight: Number(item.weight_kg).toFixed(1)
        };

        if (activePlan) {
          const plannedWeight = calculatePlannedWeight(item.date, activePlan);
          if (plannedWeight !== null) {
            dataPoint.planned = plannedWeight.toFixed(1);
          }
        }

        return dataPoint;
      });

      // If we have a plan, generate complete planned line from start to target date
      let chartData = weightDataPoints;
      if (activePlan) {
        const startDate = new Date(activePlan.start_date);
        const targetDate = new Date(activePlan.target_date);
        const today = new Date();
        const endDate = today < targetDate ? today : targetDate;
        
        // Create a map of existing dates
        const existingDates = new Set(weightDataPoints.map((p: any) => p.fullDate));
        
        // Generate planned points for dates not in weight data
        const plannedPoints: any[] = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (!existingDates.has(dateStr)) {
            const plannedWeight = calculatePlannedWeight(dateStr, activePlan);
            if (plannedWeight !== null) {
              plannedPoints.push({
                date: currentDate.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }),
                fullDate: dateStr,
                planned: plannedWeight.toFixed(1)
              });
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Merge and sort by date
        chartData = [...weightDataPoints, ...plannedPoints].sort((a, b) => 
          new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
        );
      }

      setData(chartData);
    } catch (error) {
      console.error("Chyba při načítání dat o váze:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlannedWeight = (date: string, plan: WeightPlan): number | null => {
    const currentDate = new Date(date);
    const startDate = new Date(plan.start_date);
    const targetDate = new Date(plan.target_date);

    if (currentDate < startDate) return null;
    if (currentDate > targetDate) return plan.target_weight_kg;

    const totalDays = (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const progress = elapsedDays / totalDays;

    const weightDiff = plan.start_weight_kg - plan.target_weight_kg;
    return plan.start_weight_kg - (weightDiff * progress);
  };

  const handleAddWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 30 || weight > 300) {
      toast.error("Zadejte platnou váhu (30-300 kg)");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeValue = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const { error } = await supabase
        .from("body_composition")
        .upsert({
          user_id: user.id,
          date: today,
          time: timeValue,
          weight_kg: weight
        }, { onConflict: 'user_id,date,time' });

      if (error) throw error;

      toast.success(`Váha ${weight} kg uložena`);
      setNewWeight("");
      setShowInput(false);
      loadWeightData();
    } catch (error) {
      console.error("Chyba při ukládání váhy:", error);
      toast.error("Nepodařilo se uložit váhu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Graf váhy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            Načítání...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Graf váhy
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              Vývoj váhy za posledních 90 dní
              {plan && (
                <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Target className="h-3 w-3" />
                  Cíl: {plan.target_weight_kg} kg
                </span>
              )}
            </CardDescription>
          </div>
          {showInput ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="kg"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-20 h-8"
                step="0.1"
                min="30"
                max="300"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddWeight()}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddWeight} disabled={saving}>
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowInput(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowInput(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Přidat
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Zatím nejsou k dispozici žádná data. Klikněte na "Přidat" pro zadání váhy.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="weight" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Skutečná váha (kg)"
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              {plan && (
                <Line 
                  type="monotone" 
                  dataKey="planned" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Plánovaná váha (kg)"
                  dot={false}
                />
              )}
              {plan && (
                <ReferenceLine 
                  y={plan.target_weight_kg} 
                  stroke="hsl(var(--chart-3))" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Cíl: ${plan.target_weight_kg} kg`, 
                    fill: 'hsl(var(--chart-3))',
                    fontSize: 12,
                    position: 'right'
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};