import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, TrendingUp, TrendingDown, Clock, Flame, Target, Minus } from "lucide-react";

interface WeekData {
  week: string;
  trainings: number;
  kilometers: number;
  minutes: number;
  calories: number;
}

interface TrendInfo {
  value: number;
  isUp: boolean;
  isEqual: boolean;
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: TrendInfo;
  color?: string;
}

export const WeeklyOverview = () => {
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStats, setCurrentWeekStats] = useState({
    trainings: 0,
    kilometers: 0,
    minutes: 0,
    calories: 0,
  });
  const [lastWeekStats, setLastWeekStats] = useState({
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

      // Set current and last week stats for trend calculation
      if (weeks.length >= 2) {
        const current = weeks[weeks.length - 1];
        const last = weeks[weeks.length - 2];
        setCurrentWeekStats({
          trainings: current.trainings,
          kilometers: current.kilometers,
          minutes: current.minutes,
          calories: current.calories,
        });
        setLastWeekStats({
          trainings: last.trainings,
          kilometers: last.kilometers,
          minutes: last.minutes,
          calories: last.calories,
        });
      } else if (weeks.length === 1) {
        const current = weeks[0];
        setCurrentWeekStats({
          trainings: current.trainings,
          kilometers: current.kilometers,
          minutes: current.minutes,
          calories: current.calories,
        });
      }

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

  const calculateTrend = (current: number, last: number): TrendInfo => {
    if (last === 0 && current === 0) return { value: 0, isUp: false, isEqual: true };
    if (last === 0) return { value: 100, isUp: true, isEqual: false };
    const diff = ((current - last) / last) * 100;
    return {
      value: Math.abs(Math.round(diff)),
      isUp: diff > 0,
      isEqual: Math.abs(diff) < 1,
    };
  };

  const TrendBadge = ({ trend }: { trend: TrendInfo }) => {
    if (trend.isEqual) {
      return (
        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
        </span>
      );
    }
    return (
      <span className={`flex items-center gap-0.5 text-xs ${trend.isUp ? 'text-green-500' : 'text-red-500'}`}>
        {trend.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend.value}%
      </span>
    );
  };

  const stats: StatCard[] = [
    {
      label: "Tréninky",
      value: currentWeekStats.trainings.toString(),
      icon: <Activity className="h-4 w-4" />,
      trend: calculateTrend(currentWeekStats.trainings, lastWeekStats.trainings),
      color: "from-blue-500/20 to-blue-600/10",
    },
    {
      label: "Kilometry",
      value: `${currentWeekStats.kilometers.toFixed(1)}`,
      icon: <Target className="h-4 w-4" />,
      trend: calculateTrend(currentWeekStats.kilometers, lastWeekStats.kilometers),
      color: "from-green-500/20 to-green-600/10",
    },
    {
      label: "Čas",
      value: formatTime(currentWeekStats.minutes),
      icon: <Clock className="h-4 w-4" />,
      trend: calculateTrend(currentWeekStats.minutes, lastWeekStats.minutes),
      color: "from-purple-500/20 to-purple-600/10",
    },
    {
      label: "Kalorie",
      value: currentWeekStats.calories.toLocaleString(),
      icon: <Flame className="h-4 w-4" />,
      trend: calculateTrend(currentWeekStats.calories, lastWeekStats.calories),
      color: "from-orange-500/20 to-orange-600/10",
    },
  ];

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            Týdenní přehled
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl" />
              ))}
            </div>
            <div className="h-48 bg-muted rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            Týdenní přehled
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center py-12 space-y-2">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Žádné aktivity za posledních 4 týdny
            </p>
            <p className="text-xs text-muted-foreground/70">
              Připoj Strava nebo Garmin v nastavení
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Tento týden
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            vs. minulý týden
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-gradient-to-br ${stat.color} rounded-xl p-3 border border-border/50 transition-transform hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {stat.icon}
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                {stat.trend && <TrendBadge trend={stat.trend} />}
              </div>
              <span className="text-xl font-bold">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-52 bg-muted/30 rounded-xl p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Čas (min)") return [formatTime(value), "Čas"];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={8} />
              <Bar
                yAxisId="left"
                dataKey="trainings"
                fill="hsl(217 91% 60%)"
                name="Tréninky"
                radius={[6, 6, 0, 0]}
                maxBarSize={35}
              />
              <Bar
                yAxisId="right"
                dataKey="kilometers"
                fill="hsl(142 71% 45%)"
                name="Kilometry"
                radius={[6, 6, 0, 0]}
                maxBarSize={35}
              />
              <Bar
                yAxisId="left"
                dataKey="minutes"
                fill="hsl(262 83% 58%)"
                name="Čas (min)"
                radius={[6, 6, 0, 0]}
                maxBarSize={35}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Calories Trend Line */}
        <div className="h-28 bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5 font-medium">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Spálené kalorie
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
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
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="hsl(25 95% 53%)"
                strokeWidth={2.5}
                dot={{ fill: "hsl(25 95% 53%)", r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                name="Kalorie"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
