import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SleepData {
  sleep_date: string;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  rem_duration_minutes: number | null;
  awake_duration_minutes: number | null;
  quality: number | null;
  hr_lowest: number | null;
  hr_average: number | null;
}

export const SleepCharts = () => {
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSleepData();
  }, []);

  const loadSleepData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("sleep_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      setSleepData(data || []);
    } catch (error) {
      console.error("Chyba při načítání spánkových dat:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Načítání...</div>;
  }

  if (sleepData.length === 0) {
    return null;
  }

  // Prepare data for charts (reverse to show oldest first)
  const chartData = [...sleepData].reverse().map(sleep => ({
    date: new Date(sleep.sleep_date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
    celkem: sleep.duration_minutes ? Math.round(sleep.duration_minutes / 60 * 10) / 10 : 0,
    hluboky: sleep.deep_sleep_minutes ? Math.round(sleep.deep_sleep_minutes / 60 * 10) / 10 : 0,
    lehky: sleep.light_sleep_minutes ? Math.round(sleep.light_sleep_minutes / 60 * 10) / 10 : 0,
    rem: sleep.rem_duration_minutes ? Math.round(sleep.rem_duration_minutes / 60 * 10) / 10 : 0,
    bdely: sleep.awake_duration_minutes ? Math.round(sleep.awake_duration_minutes / 60 * 10) / 10 : 0,
    kvalita: sleep.quality || 0,
    tep: sleep.hr_lowest || 0,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Délka spánku
          </CardTitle>
          <CardDescription>Celková délka spánku za poslední měsíc (hodiny)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
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
              <Bar dataKey="celkem" fill="hsl(var(--primary))" name="Celkem (h)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fáze spánku</CardTitle>
          <CardDescription>Rozložení spánkových fází (hodiny)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
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
              <Bar dataKey="hluboky" stackId="a" fill="hsl(var(--chart-1))" name="Hluboký" />
              <Bar dataKey="rem" stackId="a" fill="hsl(var(--chart-2))" name="REM" />
              <Bar dataKey="lehky" stackId="a" fill="hsl(var(--chart-3))" name="Lehký" />
              <Bar dataKey="bdely" stackId="a" fill="hsl(var(--chart-4))" name="Bdělý" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kvalita spánku a klidový tep</CardTitle>
          <CardDescription>Hodnocení kvality a nejnižší tepová frekvence</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="kvalita" 
                stroke="hsl(var(--chart-1))" 
                name="Kvalita (0-100)"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="tep" 
                stroke="hsl(var(--chart-2))" 
                name="Nejnižší tep (bpm)"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
