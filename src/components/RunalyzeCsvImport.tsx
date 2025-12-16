import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ImportType = 'weight' | 'sleep' | 'hrv' | 'heartRate';

interface ImportResult {
  imported: number;
  skipped: number;
}

const parseCSVLine = (line: string): string[] => {
  return line.split(',').map(cell => cell.trim());
};

const parseCSV = (content: string): { headers: string[]; rows: Record<string, string>[] } => {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(',').map(h => h.trim()) || [];
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  
  return { headers, rows };
};

export const RunalyzeCsvImport = ({ onComplete }: { onComplete?: () => void }) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedType, setSelectedType] = useState<ImportType>('weight');

  const importTypes = {
    weight: {
      label: 'Váha & složení těla',
      description: 'HealthWeight.csv - váha, tuk, voda, svaly, kosti',
      accept: '.csv'
    },
    sleep: {
      label: 'Spánek',
      description: 'HealthSleep.csv - délka, fáze, kvalita',
      accept: '.csv'
    },
    hrv: {
      label: 'HRV',
      description: 'HealthHrv.csv - variabilita srdečního tepu',
      accept: '.csv'
    },
    heartRate: {
      label: 'Klidový tep',
      description: 'HealthHeartRateRest.csv - klidová tepová frekvence',
      accept: '.csv'
    }
  };

  const importWeight = async (rows: Record<string, string>[], userId: string): Promise<ImportResult> => {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(((i + 1) / rows.length) * 100);

      if (!row.date || !row.weight) {
        skipped++;
        continue;
      }

      try {
        await supabase.from('body_composition').upsert({
          user_id: userId,
          date: row.date,
          time: row.time || null,
          weight_kg: parseFloat(row.weight),
          fat_percentage: row.fatPercentage ? parseFloat(row.fatPercentage) : null,
          water_percentage: row.waterPercentage ? parseFloat(row.waterPercentage) : null,
          muscle_percentage: row.musclePercentage ? parseFloat(row.musclePercentage) : null,
          bone_percentage: row.bonePercentage ? parseFloat(row.bonePercentage) : null
        }, {
          onConflict: 'user_id,date'
        });
        imported++;
      } catch (error) {
        console.error('Error importing weight row:', error);
        skipped++;
      }
    }

    return { imported, skipped };
  };

  const importSleep = async (rows: Record<string, string>[], userId: string): Promise<ImportResult> => {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(((i + 1) / rows.length) * 100);

      if (!row.date) {
        skipped++;
        continue;
      }

      try {
        await supabase.from('sleep_logs').upsert({
          user_id: userId,
          sleep_date: row.date,
          start_time: row.startTime || null,
          end_time: row.endTime || null,
          duration_minutes: row.duration ? parseInt(row.duration) : null,
          rem_duration_minutes: row.remDuration ? parseInt(row.remDuration) : null,
          awake_duration_minutes: row.awakeDuration ? parseInt(row.awakeDuration) : null,
          deep_sleep_minutes: row.deepSleepDuration ? parseInt(row.deepSleepDuration) : null,
          light_sleep_minutes: row.lightSleepDuration ? parseInt(row.lightSleepDuration) : null,
          unknown_sleep_minutes: row.unknownSleepDuration ? parseInt(row.unknownSleepDuration) : null,
          hr_lowest: row.hrLowest ? parseInt(row.hrLowest) : null,
          hr_average: row.hrAverage ? parseInt(row.hrAverage) : null,
          respiration_rate: row.respirationRate ? parseFloat(row.respirationRate) : null,
          quality: row.quality ? parseInt(row.quality) : null,
          source: 'Runalyze'
        }, {
          onConflict: 'user_id,sleep_date'
        });
        imported++;
      } catch (error) {
        console.error('Error importing sleep row:', error);
        skipped++;
      }
    }

    return { imported, skipped };
  };

  const importHrv = async (rows: Record<string, string>[], userId: string): Promise<ImportResult> => {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(((i + 1) / rows.length) * 100);

      if (!row.date || !row.hrv) {
        skipped++;
        continue;
      }

      try {
        await supabase.from('hrv_logs').upsert({
          user_id: userId,
          date: row.date,
          time: row.time || null,
          hrv: parseFloat(row.hrv),
          metric: row.metric || null,
          measurement_type: row.measurementType || null,
          source: 'Runalyze'
        }, {
          onConflict: 'user_id,date'
        });
        imported++;
      } catch (error) {
        console.error('Error importing HRV row:', error);
        skipped++;
      }
    }

    return { imported, skipped };
  };

  const importHeartRate = async (rows: Record<string, string>[], userId: string): Promise<ImportResult> => {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress(((i + 1) / rows.length) * 100);

      if (!row.date || !row.heartRate) {
        skipped++;
        continue;
      }

      try {
        await supabase.from('heart_rate_rest').upsert({
          user_id: userId,
          date: row.date,
          time: row.time || null,
          heart_rate: parseInt(row.heartRate),
          source: 'Runalyze'
        }, {
          onConflict: 'user_id,date'
        });
        imported++;
      } catch (error) {
        console.error('Error importing heart rate row:', error);
        skipped++;
      }
    }

    return { imported, skipped };
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Uživatel není přihlášen");

      const content = await file.text();
      const { rows } = parseCSV(content);

      let importResult: ImportResult;

      switch (selectedType) {
        case 'weight':
          importResult = await importWeight(rows, user.id);
          break;
        case 'sleep':
          importResult = await importSleep(rows, user.id);
          break;
        case 'hrv':
          importResult = await importHrv(rows, user.id);
          break;
        case 'heartRate':
          importResult = await importHeartRate(rows, user.id);
          break;
        default:
          throw new Error("Neznámý typ importu");
      }

      setResult(importResult);
      toast.success(`Import dokončen! ${importResult.imported} záznamů`);
      onComplete?.();
    } catch (error: any) {
      console.error('Chyba při importu:', error);
      toast.error("Nepodařilo se importovat data");
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Ruční import CSV
        </CardTitle>
        <CardDescription>
          Importujte jednotlivé CSV soubory z Runalyze exportu
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Typ dat</label>
          <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ImportType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(importTypes).map(([key, { label, description }]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col">
                    <span>{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => document.getElementById('csv-import-upload')?.click()}
          disabled={importing}
          variant="outline"
          className="w-full"
        >
          {importing ? "Importuji..." : `Vybrat ${importTypes[selectedType].label} CSV`}
        </Button>
        <input
          id="csv-import-upload"
          type="file"
          accept=".csv"
          onChange={handleImport}
          className="hidden"
        />

        {importing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Importuji... {Math.round(progress)}%
            </p>
          </div>
        )}

        {result && (
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Import úspěšný!</span>
            </div>
            <div className="text-sm space-y-1">
              <div>Importováno: {result.imported} záznamů</div>
              {result.skipped > 0 && (
                <div className="text-muted-foreground">Přeskočeno: {result.skipped} záznamů</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
