import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Footprints, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActivityData {
  date: string;
  steps: number;
  calories: number;
}

export const ActivityCharts = () => {
  const [data, setData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activityData, error } = await supabase
        .from("daily_activity" as any)
        .select("date, steps, calories")
        .eq("user_id", user.id)
        .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: true }) as { data: { date: string; steps: number; calories: number }[] | null; error: any };

      if (error) throw error;

      const chartData = (activityData || []).map((item: { date: string; steps: number; calories: number }) => ({
        date: new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
        steps: item.steps || 0,
        calories: item.calories || 0
      }));

      setData(chartData);
    } catch (error) {
      console.error("Chyba při načítání dat aktivity:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Načítání...</div>;
  }

  if (data.length === 0) {
    return null;
  }

  const hasSteps = data.some(d => d.steps > 0);
  const hasCalories = data.some(d => d.calories > 0);

  // Calculate averages
  const avgSteps = Math.round(data.reduce((sum, d) => sum + d.steps, 0) / data.length);
  const avgCalories = Math.round(data.reduce((sum, d) => sum + d.calories, 0) / data.length);

  return (
    <div className="space-y-6">
      {hasSteps && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Footprints className="h-5 w-5" />
              Denní kroky
            </CardTitle>
            <CardDescription>
              Průměr za období: {avgSteps.toLocaleString('cs-CZ')} kroků/den
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value: number) => [value.toLocaleString('cs-CZ'), 'Kroky']}
                />
                <Legend />
                <Bar dataKey="steps" fill="hsl(var(--chart-1))" name="Kroky" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasCalories && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Spálené kalorie
            </CardTitle>
            <CardDescription>
              Průměr za období: {avgCalories.toLocaleString('cs-CZ')} kcal/den
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value: number) => [value.toLocaleString('cs-CZ') + ' kcal', 'Kalorie']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="calories" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", r: 3 }}
                  name="Kalorie (kcal)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
