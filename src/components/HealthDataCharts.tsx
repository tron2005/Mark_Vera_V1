import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Heart, Activity, Weight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ChartData {
  date: string;
  restingHR?: number;
  hrv?: number;
  weight?: number;
}

export const HealthDataCharts = () => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [hrData, hrvData, weightData] = await Promise.all([
        supabase
          .from("heart_rate_rest")
          .select("date, heart_rate")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true }),
        supabase
          .from("hrv_logs")
          .select("date, hrv")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true }),
        supabase
          .from("body_composition")
          .select("date, weight_kg")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true })
      ]);

      // Merge data by date
      const dateMap = new Map<string, ChartData>();

      hrData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        dateMap.get(date)!.restingHR = item.heart_rate;
      });

      hrvData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        dateMap.get(date)!.hrv = Math.round(item.hrv);
      });

      weightData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        dateMap.get(date)!.weight = Number(item.weight_kg);
      });

      setData(Array.from(dateMap.values()));
    } catch (error) {
      console.error("Chyba při načítání zdravotních dat:", error);
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

  const hasHRData = data.some(d => d.restingHR);
  const hasHRVData = data.some(d => d.hrv);
  const hasWeightData = data.some(d => d.weight);

  return (
    <div className="space-y-6">
      {hasHRData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Klidový tep
            </CardTitle>
            <CardDescription>Vývoj klidové tepové frekvence za posledních 30 dní</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="restingHR" 
                  stroke="hsl(var(--chart-1))" 
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                  name="Klidový tep (bpm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasHRVData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              HRV (variabilita srdeční frekvence)
            </CardTitle>
            <CardDescription>Ukazatel regenerace a celkového stavu organismu</CardDescription>
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
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="hrv" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", r: 3 }}
                  name="HRV (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasWeightData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Weight className="h-5 w-5" />
              Váha
            </CardTitle>
            <CardDescription>Vývoj tělesné hmotnosti</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-3))", r: 3 }}
                  name="Váha (kg)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
