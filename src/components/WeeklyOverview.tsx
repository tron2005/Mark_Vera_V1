import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

interface WeekData {
  week: string;
  trainings: number;
  kilometers: number;
}

export const WeeklyOverview = () => {
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyData();
  }, []);

  const loadWeeklyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      // Load Strava activities
      const { data: stravaData } = await supabase
        .from("strava_activities")
        .select("start_date, distance_meters")
        .eq("user_id", user.id)
        .gte("start_date", fourWeeksAgo.toISOString());

      // Load Garmin activities
      const { data: garminData } = await supabase
        .from("garmin_activities")
        .select("start_date, distance_km")
        .eq("user_id", user.id)
        .gte("start_date", fourWeeksAgo.toISOString());

      // Process data into weekly buckets
      const weeklyMap = new Map<number, { trainings: number; kilometers: number }>();

      const processActivity = (date: string, distanceKm: number) => {
        const activityDate = new Date(date);
        const weekStart = new Date(activityDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        const weekKey = weekStart.getTime();

        const current = weeklyMap.get(weekKey) || { trainings: 0, kilometers: 0 };
        weeklyMap.set(weekKey, {
          trainings: current.trainings + 1,
          kilometers: current.kilometers + distanceKm,
        });
      };

      stravaData?.forEach((activity) => {
        processActivity(activity.start_date, (activity.distance_meters || 0) / 1000);
      });

      garminData?.forEach((activity) => {
        processActivity(activity.start_date, activity.distance_km || 0);
      });

      // Convert to array and sort
      const weeks = Array.from(weeklyMap.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(-4) // Last 4 weeks
        .map(([timestamp, data]) => {
          const weekStart = new Date(timestamp);
          const weekLabel = `${weekStart.getDate()}.${weekStart.getMonth() + 1}.`;
          return {
            week: weekLabel,
            trainings: data.trainings,
            kilometers: Math.round(data.kilometers * 10) / 10,
          };
        });

      setWeeklyData(weeks);
    } catch (error) {
      console.error("Error loading weekly data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Týdenní přehled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Načítám...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Týdenní přehled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="week" 
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <YAxis 
              yAxisId="left"
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              className="text-xs"
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px"
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="trainings" 
              fill="hsl(var(--primary))" 
              name="Počet tréninků"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              yAxisId="right"
              dataKey="kilometers" 
              fill="hsl(var(--accent))" 
              name="Kilometry"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
