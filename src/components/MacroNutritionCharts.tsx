import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Target, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DailyMacros {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface MacroGoals {
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
}

export const MacroNutritionCharts = () => {
  const [weeklyData, setWeeklyData] = useState<DailyMacros[]>([]);
  const [macroGoals, setMacroGoals] = useState<MacroGoals>({ protein_goal_g: 120, carbs_goal_g: 250, fat_goal_g: 70 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load macro goals
      const { data: profile } = await supabase
        .from("profiles")
        .select("protein_goal_g, carbs_goal_g, fat_goal_g")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setMacroGoals({
          protein_goal_g: profile.protein_goal_g || 120,
          carbs_goal_g: profile.carbs_goal_g || 250,
          fat_goal_g: profile.fat_goal_g || 70,
        });
      }

      // Load last 7 days of calorie entries
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateFrom = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("calorie_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", dateFrom)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      // Aggregate by date
      const dailyMap = new Map<string, DailyMacros>();

      data?.forEach((entry: any) => {
        const date = entry.entry_date;
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            protein: 0,
            carbs: 0,
            fat: 0,
            calories: 0,
          });
        }
        const day = dailyMap.get(date)!;
        day.protein += entry.protein || 0;
        day.carbs += entry.carbs || 0;
        day.fat += entry.fat || 0;
        day.calories += entry.calories || 0;
      });

      // Fill in missing days with zeros
      const result: DailyMacros[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        result.push(dailyMap.get(dateStr) || {
          date: dateStr,
          protein: 0,
          carbs: 0,
          fat: 0,
          calories: 0,
        });
      }

      setWeeklyData(result);
    } catch (error) {
      console.error("Chyba při načítání dat:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate weekly averages
  const weeklyAvg = {
    protein: weeklyData.reduce((sum, d) => sum + d.protein, 0) / 7,
    carbs: weeklyData.reduce((sum, d) => sum + d.carbs, 0) / 7,
    fat: weeklyData.reduce((sum, d) => sum + d.fat, 0) / 7,
    calories: weeklyData.reduce((sum, d) => sum + d.calories, 0) / 7,
  };

  // Format data for charts
  const chartData = weeklyData.map(d => ({
    date: new Date(d.date).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }),
    Bílkoviny: Math.round(d.protein),
    Sacharidy: Math.round(d.carbs),
    Tuky: Math.round(d.fat),
  }));

  const comparisonData = [
    {
      name: 'Bílkoviny',
      Skutečnost: Math.round(weeklyAvg.protein),
      Cíl: macroGoals.protein_goal_g,
      fill: 'hsl(var(--chart-1))',
    },
    {
      name: 'Sacharidy',
      Skutečnost: Math.round(weeklyAvg.carbs),
      Cíl: macroGoals.carbs_goal_g,
      fill: 'hsl(var(--chart-2))',
    },
    {
      name: 'Tuky',
      Skutečnost: Math.round(weeklyAvg.fat),
      Cíl: macroGoals.fat_goal_g,
      fill: 'hsl(var(--chart-3))',
    },
  ];

  const proteinPercent = Math.round((weeklyAvg.protein / macroGoals.protein_goal_g) * 100);
  const carbsPercent = Math.round((weeklyAvg.carbs / macroGoals.carbs_goal_g) * 100);
  const fatPercent = Math.round((weeklyAvg.fat / macroGoals.fat_goal_g) * 100);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vizualizace makroživin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">Načítání...</div>
        </CardContent>
      </Card>
    );
  }

  const hasData = weeklyData.some(d => d.protein > 0 || d.carbs > 0 || d.fat > 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Vizualizace makroživin
        </CardTitle>
        <CardDescription>Týdenní přehled příjmu bílkovin, sacharidů a tuků</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Zatím nemáte dostatek dat pro zobrazení grafů.</p>
            <p className="text-sm mt-2">Importujte data z Kalorických tabulek nebo přidejte záznamy manuálně.</p>
          </div>
        ) : (
          <Tabs defaultValue="trend" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trend">
                <Calendar className="h-4 w-4 mr-2" />
                Trend
              </TabsTrigger>
              <TabsTrigger value="comparison">
                <Target className="h-4 w-4 mr-2" />
                Vs. Cíle
              </TabsTrigger>
              <TabsTrigger value="stats">
                <TrendingUp className="h-4 w-4 mr-2" />
                Statistiky
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Gramy (g)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Bílkoviny" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Sacharidy" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Tuky" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Gramy (g)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="Skutečnost" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Cíl" fill="hsl(var(--muted))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Týdenní průměr vs. denní cíle
              </p>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Bílkoviny</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(weeklyAvg.protein)}g</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {proteinPercent}% denního cíle ({macroGoals.protein_goal_g}g)
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-chart-1 transition-all"
                        style={{ width: `${Math.min(proteinPercent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Sacharidy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(weeklyAvg.carbs)}g</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {carbsPercent}% denního cíle ({macroGoals.carbs_goal_g}g)
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-chart-2 transition-all"
                        style={{ width: `${Math.min(carbsPercent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tuky</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(weeklyAvg.fat)}g</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fatPercent}% denního cíle ({macroGoals.fat_goal_g}g)
                    </p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-chart-3 transition-all"
                        style={{ width: `${Math.min(fatPercent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Průměrné kalorie/den:</span>
                      <div className="text-lg font-semibold mt-1">{Math.round(weeklyAvg.calories)} kcal</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Celkem za týden:</span>
                      <div className="text-lg font-semibold mt-1">{Math.round(weeklyAvg.calories * 7)} kcal</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
