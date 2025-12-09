import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

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
}

export const CalorieImport = () => {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseKalorickeTabulky = (workbook: XLSX.WorkBook): ImportResult => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    
    const meals: ImportedMeal[] = [];
    const activities: { name: string; calories: number }[] = [];
    let currentSection = "";
    
    for (const row of data) {
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || "").trim();
      
      // Detect sections
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
      
      // Parse food items
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
      
      // Parse activities
      if (currentSection === "activities" && row[3]) {
        const name = String(row[0] || "").trim();
        const calories = parseInt(String(row[3] || "0"));
        
        if (name && calories > 0 && !name.includes("Název")) {
          activities.push({ name, calories });
        }
      }
    }
    
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    
    return { meals, totalCalories, activities };
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
      
      toast.success(`Načteno ${parsed.meals.length} položek`);
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

  const handleSaveToday = async () => {
    if (!result || result.meals.length === 0) return;
    
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");
      
      const notes = result.meals.map(meal => ({
        user_id: user.id,
        text: `${meal.name}: ${meal.calories} kcal`,
        category: "calories"
      }));
      
      const { error } = await supabase.from("notes").insert(notes);
      if (error) throw error;
      
      toast.success(`Uloženo ${result.meals.length} položek jako dnešní kalorie`);
      setResult(null);
    } catch (error) {
      console.error("Chyba při ukládání:", error);
      toast.error("Nepodařilo se uložit");
    } finally {
      setImporting(false);
    }
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

            <Button onClick={handleSaveToday} disabled={importing} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Uložit jako dnešní kalorie
            </Button>
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Exportujte data z kaloricketabulky.cz → Deník → Export do Excelu
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
