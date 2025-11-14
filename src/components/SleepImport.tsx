import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Moon, Check, Upload } from "lucide-react";

export const SleepImport = ({ onImportComplete }: { onImportComplete?: () => void }) => {
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const parseSleepCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const sleepData = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      const entry: any = {};

      headers.forEach((header, index) => {
        entry[header.trim()] = values[index]?.trim();
      });

      if (entry.date) {
        sleepData.push(entry);
      }
    }

    return sleepData;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    let successCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Musíte být přihlášeni");
        return;
      }

      const text = await file.text();
      const sleepData = parseSleepCSV(text);

      for (const entry of sleepData) {
        try {
          const { error: insertError } = await supabase
            .from("sleep_logs")
            .insert({
              user_id: user.id,
              sleep_date: entry.date,
              start_time: entry.startTime || null,
              end_time: entry.endTime || null,
              duration_minutes: parseInt(entry.duration) || null,
              rem_duration_minutes: parseInt(entry.remDuration) || null,
              awake_duration_minutes: parseInt(entry.awakeDuration) || null,
              deep_sleep_minutes: parseInt(entry.deepSleepDuration) || null,
              light_sleep_minutes: parseInt(entry.lightSleepDuration) || null,
              unknown_sleep_minutes: parseInt(entry.unknownSleepDuration) || null,
              hr_lowest: parseInt(entry.hrLowest) || null,
              hr_average: parseInt(entry.hrAverage) || null,
              respiration_rate: parseFloat(entry.respirationRate) || null,
              quality: parseInt(entry.quality) || null,
            });

          if (!insertError) {
            successCount++;
          }
        } catch (error) {
          console.error('Chyba při zpracování záznamu:', error);
        }
      }

      setImportedCount(prev => prev + successCount);
      
      if (successCount > 0) {
        toast.success(`Importováno ${successCount} spánkových záznamů`);
        onImportComplete?.();
      } else {
        toast.error("Nepodařilo se importovat žádné záznamy");
      }
    } catch (error) {
      console.error('Chyba při čtení souboru:', error);
      toast.error("Chyba při zpracování CSV souboru");
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Moon className="h-5 w-5" />
          Import spánkových dat
        </CardTitle>
        <CardDescription>
          Nahrajte CSV soubor se spánkovými daty z Runalyze
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={importing}
              className="hidden"
              id="sleep-csv-input"
            />
            <label
              htmlFor="sleep-csv-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {importing ? "Importuji..." : "Klikněte pro výběr CSV souboru"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Export z Runalyze → Spánek → Export jako CSV
                </p>
              </div>
            </label>
          </div>

          {importedCount > 0 && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
              <Check className="h-5 w-5" />
              <span>Celkem importováno: {importedCount} záznamů</span>
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Jak exportovat data z Runalyze:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1 ml-2">
              <li>Přihlaste se na Runalyze.com</li>
              <li>Přejděte do sekce "Spánek"</li>
              <li>Klikněte na "Export" → "CSV"</li>
              <li>Stáhněte soubor a nahrajte zde</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};