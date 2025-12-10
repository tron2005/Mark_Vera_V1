import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import * as XLSX from "xlsx";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ImportedMeal {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface ImportResult {
  meals: ImportedMeal[];
  totalCalories: number;
  activities: { name: string; calories: number }[];
  date: string | null;
  sheetName: string;
}

interface DailyCalories {
  date: string;
  calories: number;
  label: string;
}

export const CalorieImport = () => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [calorieHistory, setCalorieHistory] = useState<DailyCalories[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCalorieHistory();
  }, []);

  const loadCalorieHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("notes")
        .select("text, created_at")
        .eq("user_id", user.id)
        .eq("category", "calories")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by day and sum calories
      const dailyMap = new Map<string, number>();
      data?.forEach(note => {
        const day = note.created_at?.split('T')[0];
        if (!day) return;
        const match = note.text.match(/(\d+)\s*kcal/i);
        const kcal = match ? parseInt(match[1]) : 0;
        dailyMap.set(day, (dailyMap.get(day) || 0) + kcal);
      });

      const history: DailyCalories[] = Array.from(dailyMap.entries()).map(([date, calories]) => ({
        date,
        calories,
        label: new Date(date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
      }));

      setCalorieHistory(history);
    } catch (error) {
      console.error("Error loading calorie history:", error);
    }
  };

  // Parse date from sheet name like "8.12.2024" or content
  const parseDateFromSheetName = (sheetName: string): string | null => {
    const match = sheetName.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  // Try to find date in cell content
  const findDateInContent = (data: string[][]): string | null => {
    for (const row of data.slice(0, 10)) {
      for (const cell of row) {
        if (!cell) continue;
        const str = String(cell);
        const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (match) {
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        }
      }
    }
    return null;
  };

  const parseKalorickeTabulky = (workbook: XLSX.WorkBook): ImportResult => {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    
    const meals: ImportedMeal[] = [];
    const activities: { name: string; calories: number }[] = [];
    let currentSection = "";
    
    // Try sheet name first, then content
    let date = parseDateFromSheetName(sheetName);
    if (!date) {
      date = findDateInContent(data);
    }
    
    for (const row of data) {
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || "").trim();
      
      if (firstCell.includes("Snídaně") || firstCell.includes("Oběd") || 
          firstCell.includes("Večeře") || firstCell.includes("svačina")) {
        currentSection = "food";
        continue;
      }
      
      if (firstCell === "Aktivity") {
        currentSection = "activities";
        continue;
      }
      
      if (firstCell === "Potraviny celkem" || firstCell === "Aktivity celkem") {
        currentSection = "";
        continue;
      }
      
      if (currentSection === "food" && row[3]) {
        const name = String(row[0] || "").trim();
        const calories = parseInt(String(row[3] || "0"));
        const protein = parseFloat(String(row[4] || "0"));
        const carbs = parseFloat(String(row[5] || "0"));
        const fat = parseFloat(String(row[7] || "0"));
        
        if (name && calories > 0 && !name.includes("Název")) {
          meals.push({ name, calories, protein, carbs, fat });
        }
      }
      
      if (currentSection === "activities" && row[3]) {
        const name = String(row[0] || "").trim();
        const calories = parseInt(String(row[3] || "0"));
        
        if (name && calories > 0 && !name.includes("Název")) {
          activities.push({ name, calories });
        }
      }
    }
    
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    
    return { meals, totalCalories, activities, date, sheetName };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setResult(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      
      const parsed = parseKalorickeTabulky(workbook);
      setResult(parsed);
      
      if (parsed.meals.length === 0) {
        toast.warning("Nebyla nalezena žádná jídla v souboru");
        return;
      }
      
      const dateInfo = parsed.date 
        ? `pro ${new Date(parsed.date).toLocaleDateString('cs-CZ')}`
        : "";
      toast.success(`Načteno ${parsed.meals.length} položek ${dateInfo}`);
    } catch (error) {
      console.error("Chyba při čtení souboru:", error);
      toast.error("Nepodařilo se přečíst soubor");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    if (!result || result.meals.length === 0) return;
    
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");
      
      // Use the date from sheet name, or today if not found
      const targetDate = result.date || new Date().toISOString().split('T')[0];
      const targetDateTime = new Date(`${targetDate}T12:00:00`).toISOString();
      
      const notes = result.meals.map(meal => ({
        user_id: user.id,
        text: `${meal.name}: ${meal.calories} kcal`,
        category: "calories",
        created_at: targetDateTime
      }));
      
      const { error } = await supabase.from("notes").insert(notes);
      if (error) throw error;
      
      const dateStr = new Date(targetDate).toLocaleDateString('cs-CZ');
      toast.success(`Uloženo ${result.meals.length} položek pro ${dateStr}`);
      setResult(null);
      loadCalorieHistory(); // Refresh chart
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string | null, sheetName: string) => {
    if (dateStr) {
      return new Date(dateStr).toLocaleDateString('cs-CZ', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    }
    return sheetName;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import z Kalorických Tabulek
        </CardTitle>
        <CardDescription>
          Nahrajte XLS export z kaloricketabulky.cz
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileUpload}
            className="hidden"
            id="calorie-import"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Načítám..." : "Nahrát XLS soubor"}
          </Button>
        </div>

        {result && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            {/* Date info from sheet */}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {formatDate(result.date, result.sheetName)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Nalezeno {result.meals.length} jídel</div>
                <div className="text-sm text-muted-foreground">
                  Celkem: {result.totalCalories} kcal
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                {result.totalCalories} kcal
              </div>
            </div>

            {result.meals.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {result.meals.slice(0, 10).map((meal, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-border/50">
                    <span className="truncate flex-1 mr-2">{meal.name}</span>
                    <span className="font-medium">{meal.calories} kcal</span>
                  </div>
                ))}
                {result.meals.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    ...a dalších {result.meals.length - 10} položek
                  </div>
                )}
              </div>
            )}

            {result.activities.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Aktivity:</div>
                {result.activities.map((act, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{act.name}</span>
                    <span>-{act.calories} kcal</span>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleSave} disabled={importing || result.meals.length === 0} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Uložit pro {result.date ? new Date(result.date).toLocaleDateString('cs-CZ') : 'dnes'}
            </Button>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Exportujte data z kaloricketabulky.cz → Deník → Export do Excelu.
          </span>
        </div>

        {/* Calorie History Chart */}
        {calorieHistory.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Kalorie za posledních 30 dní</span>
            </div>
            <ChartContainer config={{ calories: { label: "Kalorie", color: "hsl(var(--primary))" } }} className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calorieHistory}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="calories" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
