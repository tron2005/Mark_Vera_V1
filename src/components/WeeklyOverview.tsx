import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, TrendingUp, Clock, Flame, Target } from "lucide-react";

interface WeekData {
  week: string;
  trainings: number;
  kilometers: number;
  minutes: number;
  calories: number;
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export const WeeklyOverview = () => {
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    trainings: 0,
    kilometers: 0,
    minutes: 0,
    calories: 0,
  });

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
        .select("start_date, distance_meters, moving_time_seconds, calories")
        .eq("user_id", user.id)
        .gte("start_date", fourWeeksAgo.toISOString());

      // Load Garmin activities
      const { data: garminData } = await supabase
        .from("garmin_activities")
        .select("start_date, distance_km, duration_seconds, calories")
        .eq("user_id", user.id)
        .gte("start_date", fourWeeksAgo.toISOString());

      // Load BodyCombat workouts
      const { data: combatData } = await supabase
        .from("bodycombat_workouts")
        .select("workout_date, duration_minutes, calories_estimate")
        .eq("user_id", user.id)
        .gte("workout_date", fourWeeksAgo.toISOString());

      // Process data into weekly buckets
      const weeklyMap = new Map<number, WeekData>();

      const getWeekKey = (date: Date) => {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
      };

      const processActivity = (date: string, distanceKm: number, minutes: number, calories: number) => {
        const activityDate = new Date(date);
        const weekKey = getWeekKey(activityDate);

        const current = weeklyMap.get(weekKey) || { week: "", trainings: 0, kilometers: 0, minutes: 0, calories: 0 };
        weeklyMap.set(weekKey, {
          ...current,
          trainings: current.trainings + 1,
          kilometers: current.kilometers + distanceKm,
          minutes: current.minutes + minutes,
          calories: current.calories + calories,
        });
      };

      stravaData?.forEach((activity) => {
        processActivity(
          activity.start_date,
          (activity.distance_meters || 0) / 1000,
          (activity.moving_time_seconds || 0) / 60,
          activity.calories || 0
        );
      });

      garminData?.forEach((activity) => {
        processActivity(
          activity.start_date,
          activity.distance_km || 0,
          (activity.duration_seconds || 0) / 60,
          activity.calories || 0
        );
      });

      combatData?.forEach((workout) => {
        processActivity(
          workout.workout_date,
          0,
          workout.duration_minutes || 0,
          workout.calories_estimate || 0
        );
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
            minutes: Math.round(data.minutes),
            calories: Math.round(data.calories),
          };
        });

      // Calculate totals
      const totals = weeks.reduce(
        (acc, week) => ({
          trainings: acc.trainings + week.trainings,
          kilometers: acc.kilometers + week.kilometers,
          minutes: acc.minutes + week.minutes,
          calories: acc.calories + week.calories,
        }),
        { trainings: 0, kilometers: 0, minutes: 0, calories: 0 }
      );

      setTotalStats(totals);
      setWeeklyData(weeks);
    } catch (error) {
      console.error("Error loading weekly data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const stats: StatCard[] = [
    {
      label: "Tréninky",
      value: totalStats.trainings.toString(),
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Kilometry",
      value: `${totalStats.kilometers.toFixed(1)} km`,
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: "Čas",
      value: formatTime(totalStats.minutes),
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Kalorie",
      value: totalStats.calories.toLocaleString(),
      icon: <Flame className="h-4 w-4" />,
    },
  ];

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
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Týdenní přehled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Žádné aktivity za posledních 4 týdny. Připoj Strava nebo Garmin v nastavení.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Týdenní přehled (4 týdny)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-muted/50 rounded-lg p-3 flex flex-col items-center justify-center text-center"
            >
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                {stat.icon}
                <span className="text-xs">{stat.label}</span>
              </div>
              <span className="text-lg font-bold">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="week"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Čas (min)") return [formatTime(value), "Čas"];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                iconSize={8}
              />
              <Bar
                yAxisId="left"
                dataKey="trainings"
                fill="hsl(var(--primary))"
                name="Tréninky"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="right"
                dataKey="kilometers"
                fill="hsl(var(--chart-2))"
                name="Kilometry"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                yAxisId="left"
                dataKey="minutes"
                fill="hsl(var(--chart-3))"
                name="Čas (min)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Calories Trend Line */}
        <div className="h-32">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Kalorie podle týdnů
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))", r: 4 }}
                name="Kalorie"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
