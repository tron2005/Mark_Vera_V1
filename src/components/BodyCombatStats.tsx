import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Calendar, Flame, Clock, TrendingUp } from "lucide-react";

interface Stats {
  totalWorkouts: number;
  totalMinutes: number;
  totalCalories: number;
  averageIntensity: number;
  thisWeek: number;
  thisMonth: number;
}

export const BodyCombatStats = () => {
  const [stats, setStats] = useState<Stats>({
    totalWorkouts: 0,
    totalMinutes: 0,
    totalCalories: 0,
    averageIntensity: 0,
    thisWeek: 0,
    thisMonth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: workouts, error } = await supabase
        .from("bodycombat_workouts")
        .select("*")
        .eq("user_id", user.id)
        .order("workout_date", { ascending: false });

      if (error) throw error;

      if (!workouts || workouts.length === 0) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
      const totalCalories = workouts.reduce((sum, w) => sum + (w.calories_estimate || 0), 0);
      const intensityWorkouts = workouts.filter(w => w.intensity);
      const averageIntensity = intensityWorkouts.length > 0
        ? intensityWorkouts.reduce((sum, w) => sum + w.intensity!, 0) / intensityWorkouts.length
        : 0;

      const thisWeek = workouts.filter(w => new Date(w.workout_date) >= weekAgo).length;
      const thisMonth = workouts.filter(w => new Date(w.workout_date) >= monthAgo).length;

      setStats({
        totalWorkouts: workouts.length,
        totalMinutes,
        totalCalories,
        averageIntensity,
        thisWeek,
        thisMonth
      });
    } catch (error) {
      console.error("Chyba při načítání statistik BodyCombat:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BodyCombat Statistiky</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            Načítání...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.totalWorkouts === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            BodyCombat Statistiky
          </CardTitle>
          <CardDescription>Přehled vašich BodyCombat tréninků</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Zatím nejsou zaznamenané žádné BodyCombat tréninky.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          BodyCombat Statistiky
        </CardTitle>
        <CardDescription>Přehled vašich BodyCombat tréninků</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Celkem tréninků</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Celkem minut</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalMinutes}</div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Flame className="h-4 w-4" />
              <span className="text-xs">Celkem kcal</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalCalories}</div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Prům. intenzita</span>
            </div>
            <div className="text-2xl font-bold">
              {stats.averageIntensity > 0 ? stats.averageIntensity.toFixed(1) : 'N/A'}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Tento týden</span>
            </div>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Tento měsíc</span>
            </div>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
