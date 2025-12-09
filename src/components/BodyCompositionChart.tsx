import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

interface CompositionData {
  date: string;
  fullDate: string;
  weight?: number;
  fat?: number;
  muscle?: number;
  water?: number;
}

export const BodyCompositionChart = () => {
  const [data, setData] = useState<CompositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    weight: "",
    fat: "",
    muscle: "",
    water: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: compositions, error } = await supabase
        .from("body_composition")
        .select("date, weight_kg, fat_percentage, muscle_percentage, water_percentage")
        .eq("user_id", user.id)
        .order("date", { ascending: true })
        .limit(90);

      if (error) throw error;

      const chartData: CompositionData[] = (compositions || []).map((item) => ({
        date: new Date(item.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }),
        fullDate: item.date,
        weight: item.weight_kg ? Number(item.weight_kg) : undefined,
        fat: item.fat_percentage ? Number(item.fat_percentage) : undefined,
        muscle: item.muscle_percentage ? Number(item.muscle_percentage) : undefined,
        water: item.water_percentage ? Number(item.water_percentage) : undefined
      }));

      setData(chartData);
    } catch (error) {
      console.error("Chyba při načítání dat:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const weight = parseFloat(formData.weight);
    if (isNaN(weight) || weight < 30 || weight > 300) {
      toast.error("Zadejte platnou váhu (30-300 kg)");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      const today = new Date().toISOString().split('T')[0];
      
      const record: any = {
        user_id: user.id,
        date: today,
        weight_kg: weight
      };

      const fat = parseFloat(formData.fat);
      const muscle = parseFloat(formData.muscle);
      const water = parseFloat(formData.water);

      if (!isNaN(fat) && fat >= 0 && fat <= 100) record.fat_percentage = fat;
      if (!isNaN(muscle) && muscle >= 0 && muscle <= 100) record.muscle_percentage = muscle;
      if (!isNaN(water) && water >= 0 && water <= 100) record.water_percentage = water;

      const { error } = await supabase
        .from("body_composition")
        .upsert(record, { onConflict: 'user_id,date' });

      if (error) throw error;

      toast.success("Složení těla uloženo");
      setFormData({ weight: "", fat: "", muscle: "", water: "" });
      setShowInput(false);
      loadData();
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    } finally {
      setSaving(false);
    }
  };

  // Check if we have any fat/muscle data
  const hasFatData = data.some(d => d.fat !== undefined);
  const hasMuscleData = data.some(d => d.muscle !== undefined);
  const hasWaterData = data.some(d => d.water !== undefined);

  // Get latest values for stats
  const latest = data.length > 0 ? data[data.length - 1] : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Složení těla</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
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
              <Activity className="h-5 w-5" />
              Složení těla
            </CardTitle>
            <CardDescription>
              Tuk, svaly a voda za posledních 90 dní
            </CardDescription>
          </div>
          {showInput ? (
            <Button size="sm" variant="ghost" onClick={() => setShowInput(false)}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowInput(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Přidat
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInput && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label htmlFor="weight" className="text-xs">Váha (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="75"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                step="0.1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fat" className="text-xs">Tuk (%)</Label>
              <Input
                id="fat"
                type="number"
                placeholder="20"
                value={formData.fat}
                onChange={(e) => setFormData(prev => ({ ...prev, fat: e.target.value }))}
                step="0.1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="muscle" className="text-xs">Svaly (%)</Label>
              <Input
                id="muscle"
                type="number"
                placeholder="40"
                value={formData.muscle}
                onChange={(e) => setFormData(prev => ({ ...prev, muscle: e.target.value }))}
                step="0.1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="water" className="text-xs">Voda (%)</Label>
              <Input
                id="water"
                type="number"
                placeholder="55"
                value={formData.water}
                onChange={(e) => setFormData(prev => ({ ...prev, water: e.target.value }))}
                step="0.1"
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Check className="h-4 w-4 mr-1" />
                {saving ? "Ukládám..." : "Uložit"}
              </Button>
            </div>
          </div>
        )}

        {/* Latest stats */}
        {latest && (hasFatData || hasMuscleData || hasWaterData) && (
          <div className="grid grid-cols-3 gap-4">
            {latest.fat !== undefined && (
              <div className="text-center p-3 rounded-lg bg-orange-500/10">
                <div className="text-2xl font-bold text-orange-500">{latest.fat.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Tuk</div>
              </div>
            )}
            {latest.muscle !== undefined && (
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-2xl font-bold text-green-500">{latest.muscle.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Svaly</div>
              </div>
            )}
            {latest.water !== undefined && (
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-2xl font-bold text-blue-500">{latest.water.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Voda</div>
              </div>
            )}
          </div>
        )}

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Zatím nejsou k dispozici žádná data. Klikněte na "Přidat".
          </p>
        ) : (hasFatData || hasMuscleData || hasWaterData) ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 100]}
                unit="%"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`]}
              />
              <Legend />
              {hasFatData && (
                <Line 
                  type="monotone" 
                  dataKey="fat" 
                  stroke="#f97316"
                  strokeWidth={2}
                  name="Tuk (%)"
                  dot={{ fill: '#f97316', r: 3 }}
                  connectNulls
                />
              )}
              {hasMuscleData && (
                <Line 
                  type="monotone" 
                  dataKey="muscle" 
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Svaly (%)"
                  dot={{ fill: '#22c55e', r: 3 }}
                  connectNulls
                />
              )}
              {hasWaterData && (
                <Line 
                  type="monotone" 
                  dataKey="water" 
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Voda (%)"
                  dot={{ fill: '#3b82f6', r: 3 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Data o váze jsou k dispozici, přidejte hodnoty tuku/svalů pro zobrazení grafu.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
