import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database, RefreshCw, Archive, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const CalorieMigration = () => {
  const [migrating, setMigrating] = useState(false);
  const [stats, setStats] = useState<{ found: number; migrated: number } | null>(null);

  const handleMigration = async () => {
    setMigrating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch old notes with category 'calories'
      const { data: notes, error: fetchError } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", "calories");

      if (fetchError) throw fetchError;

      if (!notes || notes.length === 0) {
        toast.info("Nebyly nalezeny žádné staré poznámky k převedení.");
        setMigrating(false);
        return;
      }

      let migratedCount = 0;
      let errors = 0;

      // 2. Process each note
      // Format usually: "Snídaně: Rohlík (300 kcal)..." or similar from imports
      // But actually, imports create notes with JSON-like structure or specific format?
      // Based on CalorieImport.tsx before refactor:
      // It was parsing `(\d+)\s*kcal` from text.
      // We will try our best to extract Calories and Name.

      for (const note of notes) {
        const text = note.text;
        const date = note.created_at.split('T')[0];
        
        // Try to parse calories
        const kcalMatch = text.match(/(\d+)\s*kcal/i);
        const calories = kcalMatch ? parseInt(kcalMatch[1]) : 0;
        
        if (calories > 0) {
            // Try to extract name (everything before calories?)
            // e.g. "Snídaně: Banán - 100 kcal"
            let name = text.split(kcalMatch[0])[0].trim();
            if (name.endsWith("-") || name.endsWith(":")) name = name.slice(0, -1).trim();
            if (!name) name = "Importované jídlo";

            // Insert into calorie_entries
            const { error: insertError } = await supabase
                .from("calorie_entries")
                .upsert({
                    user_id: user.id,
                    entry_date: date, // Using created_at of note as entry date
                    meal_name: name,
                    calories: calories,
                    source: 'migration' // Mark as migrated
                }, { onConflict: 'user_id,entry_date,meal_name' }); // Prevent duplicates if ran multiple times

            if (!insertError) {
                migratedCount++;
                // Optionally delete the note? No, keep it for safety, user can delete later.
                // Or maybe updating category to 'archived_calories'?
                await supabase
                    .from("notes")
                    .update({ category: 'archived_calories' })
                    .eq("id", note.id);
            } else {
                errors++;
            }
        }
      }

      setStats({ found: notes.length, migrated: migratedCount });
      toast.success(`Převedeno ${migratedCount} záznamů.`);

    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Chyba při migraci dat.");
    } finally {
      setMigrating(false);
    }
  };

  if (stats) {
    return (
        <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="flex items-center gap-4 py-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                    <h3 className="font-semibold text-green-700">Hotovo!</h3>
                    <p className="text-sm text-green-700/80">
                        Úspěšně převedeno {stats.migrated} záznamů ze starých poznámek.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Oprava starých dat
        </CardTitle>
        <CardDescription>
            Našli jsme starší záznamy (poznámky), které se nezobrazují v nových grafech.
            Můžete je jedním kliknutím převést do nové databáze.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleMigration} disabled={migrating} variant="secondary" className="w-full">
            {migrating ? (
                <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Převádím data...
                </>
            ) : (
                <>
                    <Archive className="h-4 w-4 mr-2" />
                    Převést starou historii
                </>
            )}
        </Button>
      </CardContent>
    </Card>
  );
};
