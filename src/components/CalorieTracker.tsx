import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Utensils, Plus, Trash2, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface MacroGoals {
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
}

export const CalorieTracker = () => {
  const [entries, setEntries] = useState<CalorieEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [userBMR, setUserBMR] = useState<number | null>(null);
  const [macroGoals, setMacroGoals] = useState<MacroGoals>({ protein_goal_g: 120, carbs_goal_g: 250, fat_goal_g: 70 });
  const [goalForm, setGoalForm] = useState<MacroGoals>({ protein_goal_g: 120, carbs_goal_g: 250, fat_goal_g: 70 });
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load user profile with BMR and macro goals
      const { data: profile } = await supabase
        .from("profiles")
        .select("bmr, protein_goal_g, carbs_goal_g, fat_goal_g")
        .eq("user_id", user.id)
        .single();

      if (profile?.bmr) {
        setUserBMR(Math.round(profile.bmr));
        setDailyGoal(Math.round(profile.bmr * 1.3));
      }

      if (profile) {
        const goals = {
          protein_goal_g: profile.protein_goal_g || 120,
          carbs_goal_g: profile.carbs_goal_g || 250,
          fat_goal_g: profile.fat_goal_g || 70,
        };
        setMacroGoals(goals);
        setGoalForm(goals);
      }

      // Load today's calorie entries
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

  const saveGoals = async () => {
    setSavingGoals(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          protein_goal_g: goalForm.protein_goal_g,
          carbs_goal_g: goalForm.carbs_goal_g,
          fat_goal_g: goalForm.fat_goal_g,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setMacroGoals(goalForm);
      toast.success("Cíle uloženy");
      setGoalsDialogOpen(false);
    } catch (error) {
      console.error("Chyba při ukládání cílů:", error);
      toast.error("Nepodařilo se uložit cíle");
    } finally {
      setSavingGoals(false);
    }
  };

  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const progressPercent = Math.min((totalCalories / dailyGoal) * 100, 100);

  // Calculate macros totals
  const totalProtein = entries.reduce((sum, entry) => sum + (entry.protein || 0), 0);
  const totalCarbs = entries.reduce((sum, entry) => sum + (entry.carbs || 0), 0);
  const totalFat = entries.reduce((sum, entry) => sum + (entry.fat || 0), 0);
  const hasMacros = totalProtein > 0 || totalCarbs > 0 || totalFat > 0;

  // Progress percentages for macros
  const proteinProgress = Math.min((totalProtein / macroGoals.protein_goal_g) * 100, 100);
  const carbsProgress = Math.min((totalCarbs / macroGoals.carbs_goal_g) * 100, 100);
  const fatProgress = Math.min((totalFat / macroGoals.fat_goal_g) * 100, 100);

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
          <div className="flex items-center justify-center py-8">Načítání...</div>
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
            <CardDescription>Sledování denního příjmu kalorií</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={goalsDialogOpen} onOpenChange={setGoalsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Denní cíle makroživin</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Bílkoviny (g)</Label>
                    <Input
                      type="number"
                      value={goalForm.protein_goal_g}
                      onChange={(e) => setGoalForm({ ...goalForm, protein_goal_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sacharidy (g)</Label>
                    <Input
                      type="number"
                      value={goalForm.carbs_goal_g}
                      onChange={(e) => setGoalForm({ ...goalForm, carbs_goal_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tuky (g)</Label>
                    <Input
                      type="number"
                      value={goalForm.fat_goal_g}
                      onChange={(e) => setGoalForm({ ...goalForm, fat_goal_g: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <Button onClick={saveGoals} className="w-full" disabled={savingGoals}>
                    {savingGoals ? "Ukládám..." : "Uložit cíle"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? "outline" : "default"}>
              <Plus className="h-4 w-4 mr-1" />
              {showForm ? "Zrušit" : "Přidat"}
            </Button>
          </div>
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

        {/* Macros Section with Progress Bars */}
        <div className="space-y-3 pt-2 border-t">
          <h4 className="text-sm font-medium">Makroživiny</h4>
          
          {hasMacros && (
            <div className="flex items-center gap-4 mb-3">
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={38}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)} g`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {/* Protein */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                      Bílkoviny
                    </span>
                    <span>{totalProtein.toFixed(0)} / {macroGoals.protein_goal_g}g</span>
                  </div>
                  <Progress value={proteinProgress} className="h-1.5" />
                </div>
                {/* Carbs */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                      Sacharidy
                    </span>
                    <span>{totalCarbs.toFixed(0)} / {macroGoals.carbs_goal_g}g</span>
                  </div>
                  <Progress value={carbsProgress} className="h-1.5" />
                </div>
                {/* Fat */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                      Tuky
                    </span>
                    <span>{totalFat.toFixed(0)} / {macroGoals.fat_goal_g}g</span>
                  </div>
                  <Progress value={fatProgress} className="h-1.5" />
                </div>
              </div>
            </div>
          )}

          {!hasMacros && (
            <p className="text-xs text-muted-foreground">
              Importujte data z Kalorických tabulek pro zobrazení makroživin
            </p>
          )}
        </div>

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
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
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
