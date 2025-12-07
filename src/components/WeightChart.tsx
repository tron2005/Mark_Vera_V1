import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, Target } from "lucide-react";

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

  useEffect(() => {
    loadWeightData();
  }, []);

  const loadWeightData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load weight data and active plan in parallel
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

      // Calculate planned weight for each date if plan exists
      const chartData = (weightResult.data || []).map((item: any) => {
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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Graf váhy
          </CardTitle>
          <CardDescription>Sledujte vývoj váhy v čase</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Zatím nejsou k dispozici žádná data o váze. Importujte data nebo je přidejte ručně.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Graf váhy
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Vývoj váhy za posledních 90 dní
          {plan && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              <Target className="h-3 w-3" />
              Cíl: {plan.target_weight_kg} kg
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};