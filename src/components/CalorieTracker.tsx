import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Utensils, Plus, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface CalorieEntry {
  id: string;
  user_id: string;
  entry_date: string;
  meal_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  salt: number | null;
  created_at: string;
}

export const CalorieTracker = () => {
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [userBMR, setUserBMR] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user BMR for daily goal
      const { data: profile } = await supabase
        .from("profiles")
        .select("bmr")
        .eq("user_id", user.id)
        .single();

      if (profile?.bmr) {
        setUserBMR(Math.round(profile.bmr));
        setDailyGoal(Math.round(profile.bmr * 1.3)); // Light activity multiplier
      }

      // Load today's calorie entries from calorie_entries table
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("calorie_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", today)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      console.error("Chyba při načítání kalorií:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mealName.trim() || !calories) {
      toast.error("Vyplňte název jídla a kalorie");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from("calorie_entries")
        .insert({
          user_id: user.id,
          entry_date: today,
          meal_name: mealName,
          calories: parseInt(calories),
          source: 'manual'
        });

      if (error) throw error;

      toast.success("Kalorie přidány");
      setMealName("");
      setCalories("");
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("calorie_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Záznam odstraněn");
      loadData();
    } catch (error) {
      console.error("Chyba při mazání:", error);
      toast.error("Nepodařilo se odstranit");
    }
  };

  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const progressPercent = Math.min((totalCalories / dailyGoal) * 100, 100);

  // Calculate macros totals
  const totalProtein = entries.reduce((sum, entry) => sum + (entry.protein || 0), 0);
  const totalCarbs = entries.reduce((sum, entry) => sum + (entry.carbs || 0), 0);
  const totalFat = entries.reduce((sum, entry) => sum + (entry.fat || 0), 0);
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

  // Pie chart data
  const macroData = [
    { name: 'Bílkoviny', value: totalProtein, color: 'hsl(var(--chart-1))' },
    { name: 'Sacharidy', value: totalCarbs, color: 'hsl(var(--chart-2))' },
    { name: 'Tuky', value: totalFat, color: 'hsl(var(--chart-3))' },
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kalorie dnes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
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
              <Utensils className="h-5 w-5" />
              Kalorie dnes
            </CardTitle>
            <CardDescription>
              Sledování denního příjmu kalorií
            </CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? "outline" : "default"}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? "Zrušit" : "Přidat"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="meal">Název jídla</Label>
              <Input
                id="meal"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="např. Snídaně, Oběd..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calories">Kalorie (kcal)</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="500"
              />
            </div>
            <Button type="submit" className="w-full">Přidat záznam</Button>
          </form>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dnes celkem</span>
            <span className="text-2xl font-bold">{totalCalories} / {dailyGoal} kcal</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {userBMR && (
            <p className="text-xs text-muted-foreground">
              Váš BMR: {userBMR} kcal/den (cíl zahrnuje aktivitu)
            </p>
          )}
        </div>

        {/* Macros Pie Chart */}
        {hasMacros && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-medium">Makroživiny</h4>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={45}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)} g`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                  <span>Bílkoviny: <strong>{totalProtein.toFixed(1)} g</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                  <span>Sacharidy: <strong>{totalCarbs.toFixed(1)} g</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                  <span>Tuky: <strong>{totalFat.toFixed(1)} g</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {entries.length > 0 ? (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{entry.meal_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(entry.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    {(entry.protein || entry.carbs || entry.fat) && (
                      <span className="ml-2">
                        B: {entry.protein || 0}g | S: {entry.carbs || 0}g | T: {entry.fat || 0}g
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">{entry.calories} kcal</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Dnes ještě nemáte zaznamenané žádné kalorie
          </p>
        )}
      </CardContent>
    </Card>
  );
};
