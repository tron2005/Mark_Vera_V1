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
}

interface DayResult {
  meals: ImportedMeal[];
  totalCalories: number;
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
        .from("notes")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("category", "calories")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);
      
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
          .from("notes")
          .delete()
          .eq("user_id", user.id)
          .eq("category", "calories")
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);
      }
      
      const notes = dayResult.meals.map(meal => ({
        user_id: user.id,
        text: `${meal.name}: ${meal.calories} kcal`,
        category: "calories",
        created_at: targetDateTime
      }));
      
      const { error } = await supabase.from("notes").insert(notes);
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
        
        const notes = dayResult.meals.map(meal => ({
          user_id: user.id,
          text: `${meal.name}: ${meal.calories} kcal`,
          category: "calories",
          created_at: targetDateTime
        }));
        
        const { error } = await supabase.from("notes").insert(notes);
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
              {totalStats.duplicateDays > 0 && (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ {totalStats.duplicateDays} dní již má existující záznamy
                </div>
              )}
              <div className="flex gap-2 mt-3">
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
