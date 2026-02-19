import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, AlertCircle, Calendar, TrendingUp, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ImportedMeal {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  salt?: number;
}

interface DayResult {
  meals: ImportedMeal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalSugar: number;
  totalFiber: number;
  activities: { name: string; calories: number }[];
  date: string | null;
  sheetName: string;
  existingRecords: number;
}

interface DailyCalories {
  date: string;
  calories: number;
  label: string;
}

export const CalorieImport = () => {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<DayResult[]>([]);
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
        .from("calorie_entries")
        .select("calories, entry_date")
        .eq("user_id", user.id)
        .gte("entry_date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("entry_date", { ascending: true });

      if (error) throw error;

      // Group by day and sum calories
      const dailyMap = new Map<string, number>();
      data?.forEach(entry => {
        const day = entry.entry_date;
        if (!day) return;
        dailyMap.set(day, (dailyMap.get(day) || 0) + entry.calories);
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

  const parseSheet = (sheet: XLSX.WorkSheet, sheetName: string): Omit<DayResult, 'existingRecords'> => {
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
        const sugar = parseFloat(String(row[6] || "0"));
        const fat = parseFloat(String(row[7] || "0"));
        const fiber = parseFloat(String(row[8] || "0"));
        const salt = parseFloat(String(row[9] || "0"));
        
        if (name && calories > 0 && !name.includes("Název")) {
          meals.push({ name, calories, protein, carbs, fat, sugar, fiber, salt });
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
    const totalProtein = meals.reduce((sum, m) => sum + (m.protein || 0), 0);
    const totalCarbs = meals.reduce((sum, m) => sum + (m.carbs || 0), 0);
    const totalFat = meals.reduce((sum, m) => sum + (m.fat || 0), 0);
    const totalSugar = meals.reduce((sum, m) => sum + (m.sugar || 0), 0);
    const totalFiber = meals.reduce((sum, m) => sum + (m.fiber || 0), 0);
    
    return { meals, totalCalories, totalProtein, totalCarbs, totalFat, totalSugar, totalFiber, activities, date, sheetName };
  };

  const checkExistingRecords = async (dates: (string | null)[]): Promise<Map<string, number>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Map();

    const validDates = dates.filter((d): d is string => d !== null);
    if (validDates.length === 0) return new Map();

    // Get count of existing calorie records for these dates
    const existingMap = new Map<string, number>();
    
    for (const date of validDates) {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      
      const { count } = await supabase
        .from("calorie_entries")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("entry_date", date);
      
      existingMap.set(date, count || 0);
    }
    
    return existingMap;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setResults([]);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      
      // Parse ALL sheets, not just the first one
      const parsedDays: Omit<DayResult, 'existingRecords'>[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const parsed = parseSheet(sheet, sheetName);
        
        // Only include sheets that have actual meal data
        if (parsed.meals.length > 0) {
          parsedDays.push(parsed);
        }
      }
      
      if (parsedDays.length === 0) {
        toast.warning("Nebyla nalezena žádná jídla v souboru");
        return;
      }
      
      // Check for existing records
      const dates = parsedDays.map(d => d.date);
      const existingMap = await checkExistingRecords(dates);
      
      // Add existing record counts to results
      const resultsWithExisting: DayResult[] = parsedDays.map(day => ({
        ...day,
        existingRecords: day.date ? (existingMap.get(day.date) || 0) : 0
      }));
      
      setResults(resultsWithExisting);
      
      const totalMeals = parsedDays.reduce((sum, d) => sum + d.meals.length, 0);
      const daysWithDuplicates = resultsWithExisting.filter(d => d.existingRecords > 0).length;
      
      if (daysWithDuplicates > 0) {
        toast.warning(`Načteno ${totalMeals} položek za ${parsedDays.length} dní. ${daysWithDuplicates} dní už má záznamy!`);
      } else {
        toast.success(`Načteno ${totalMeals} položek za ${parsedDays.length} dní`);
      }
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

  const handleSaveDay = async (dayResult: DayResult, replaceExisting: boolean = false) => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");
      
      const targetDate = dayResult.date || new Date().toISOString().split('T')[0];
      const targetDateTime = new Date(`${targetDate}T12:00:00`).toISOString();
      
      // If replacing, delete existing records for this day first
      if (replaceExisting && dayResult.existingRecords > 0) {
        const startOfDay = `${targetDate}T00:00:00`;
        const endOfDay = `${targetDate}T23:59:59`;
        
        await supabase
        if (replaceExisting && dayResult.existingRecords > 0) {
        
        await supabase
          .from("calorie_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("entry_date", targetDate);
      }
      }
      
      const entries = dayResult.meals.map(meal => ({
        user_id: user.id,
        entry_date: targetDate,
        meal_name: meal.name,
        calories: meal.calories,
        protein: meal.protein || 0,
        carbs: meal.carbs || 0,
        fat: meal.fat || 0,
        sugar: meal.sugar || 0,
        fiber: meal.fiber || 0,
        salt: meal.salt || 0,
        source: 'kaloricke_tabulky'
      }));
      
      const { error } = await supabase.from("calorie_entries").upsert(entries, {
        onConflict: 'user_id,entry_date,meal_name'
      });
      if (error) throw error;
      
      const dateStr = new Date(targetDate).toLocaleDateString('cs-CZ');
      toast.success(`Uloženo ${dayResult.meals.length} položek pro ${dateStr}`);
      
      // Remove this day from results
      setResults(prev => prev.filter(r => r !== dayResult));
      loadCalorieHistory();
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    } finally {
      setImporting(false);
    }
  };

  const handleSaveAll = async () => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");
      
      let savedCount = 0;
      let skippedCount = 0;
      
      for (const dayResult of results) {
        // Skip days that already have records (don't create duplicates)
        if (dayResult.existingRecords > 0) {
          skippedCount++;
          continue;
        }
        
        const targetDate = dayResult.date || new Date().toISOString().split('T')[0];
        const targetDateTime = new Date(`${targetDate}T12:00:00`).toISOString();
        
        const entries = dayResult.meals.map(meal => ({
          user_id: user.id,
          entry_date: targetDate,
          meal_name: meal.name,
          calories: meal.calories,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fat: meal.fat || 0,
          sugar: meal.sugar || 0,
          fiber: meal.fiber || 0,
          salt: meal.salt || 0,
          source: 'kaloricke_tabulky'
        }));
        
        const { error } = await supabase.from("calorie_entries").upsert(entries, {
          onConflict: 'user_id,entry_date,meal_name'
        });
        if (error) throw error;
        
        savedCount++;
      }
      
      if (skippedCount > 0) {
        toast.success(`Uloženo ${savedCount} dní, přeskočeno ${skippedCount} dní s existujícími záznamy`);
      } else {
        toast.success(`Uloženo ${savedCount} dní`);
      }
      
      setResults([]);
      loadCalorieHistory();
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    } finally {
      setImporting(false);
    }
  };

  const removeDay = (dayResult: DayResult) => {
    setResults(prev => prev.filter(r => r !== dayResult));
  };

  const formatDate = (dateStr: string | null, sheetName: string) => {
    if (dateStr) {
      return new Date(dateStr).toLocaleDateString('cs-CZ', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'numeric'
      });
    }
    return sheetName;
  };

  const totalStats = {
    days: results.length,
    meals: results.reduce((sum, d) => sum + d.meals.length, 0),
    calories: results.reduce((sum, d) => sum + d.totalCalories, 0),
    protein: results.reduce((sum, d) => sum + d.totalProtein, 0),
    carbs: results.reduce((sum, d) => sum + d.totalCarbs, 0),
    fat: results.reduce((sum, d) => sum + d.totalFat, 0),
    sugar: results.reduce((sum, d) => sum + d.totalSugar, 0),
    fiber: results.reduce((sum, d) => sum + d.totalFiber, 0),
    duplicateDays: results.filter(d => d.existingRecords > 0).length
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import z Kalorických Tabulek
        </CardTitle>
        <CardDescription>
          Nahrajte XLS export z kaloricketabulky.cz (podporuje více dnů najednou)
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

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Celkem: {totalStats.days} dní, {totalStats.meals} položek</span>
                <span className="text-lg font-bold text-primary">{totalStats.calories.toLocaleString()} kcal</span>
              </div>
              
              {/* Macros summary */}
              <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
                <div className="text-center p-2 rounded bg-blue-500/10">
                  <div className="font-bold text-blue-600">{totalStats.protein.toFixed(0)}g</div>
                  <div className="text-muted-foreground">Bílkoviny</div>
                </div>
                <div className="text-center p-2 rounded bg-amber-500/10">
                  <div className="font-bold text-amber-600">{totalStats.carbs.toFixed(0)}g</div>
                  <div className="text-muted-foreground">Sacharidy</div>
                </div>
                <div className="text-center p-2 rounded bg-orange-500/10">
                  <div className="font-bold text-orange-600">{totalStats.fat.toFixed(0)}g</div>
                  <div className="text-muted-foreground">Tuky</div>
                </div>
                <div className="text-center p-2 rounded bg-pink-500/10">
                  <div className="font-bold text-pink-600">{totalStats.sugar.toFixed(0)}g</div>
                  <div className="text-muted-foreground">Cukry</div>
                </div>
                <div className="text-center p-2 rounded bg-green-500/10">
                  <div className="font-bold text-green-600">{totalStats.fiber.toFixed(0)}g</div>
                  <div className="text-muted-foreground">Vláknina</div>
                </div>
              </div>
              
              {totalStats.duplicateDays > 0 && (
                <div className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                  ⚠️ {totalStats.duplicateDays} dní již má existující záznamy
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSaveAll} disabled={importing} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Uložit nové dny ({totalStats.days - totalStats.duplicateDays})
                </Button>
                <Button variant="outline" onClick={() => setResults([])} disabled={importing}>
                  Zrušit
                </Button>
              </div>
            </div>

            {/* Individual days */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((day, index) => (
                <div 
                  key={index} 
                  className={`p-3 border rounded-lg ${day.existingRecords > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'bg-card'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">{formatDate(day.date, day.sheetName)}</span>
                      {day.existingRecords > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                          {day.existingRecords} existujících
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{day.meals.length} jídel</span>
                      <span className="font-bold">{day.totalCalories} kcal</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    {day.existingRecords > 0 ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleSaveDay(day, true)}
                          disabled={importing}
                          className="text-xs"
                        >
                          Nahradit existující
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleSaveDay(day, false)}
                          disabled={importing}
                          className="text-xs"
                        >
                          Přidat (duplikovat)
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleSaveDay(day, false)}
                        disabled={importing}
                        className="text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Uložit
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => removeDay(day)}
                      disabled={importing}
                      className="text-xs text-muted-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Exportujte data z kaloricketabulky.cz → Deník → Export do Excelu (můžete vybrat rozsah dnů).
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
