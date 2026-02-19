import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import JSZip from "jszip";

interface ImportStats {
  sleep: number;
  restingHR: number;
  hrv: number;
  weight: number;
}

export const RunalyzeFullImport = ({ onComplete }: { onComplete?: () => void }) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);

  const parseCSVLine = (line: string): string[] => {
    return line.split(',').map(cell => cell.trim());
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setStats(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Uživatel není přihlášen");

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      const importedStats: ImportStats = {
        sleep: 0,
        restingHR: 0,
        hrv: 0,
        weight: 0
      };

      const totalFiles = 4;
      let filesProcessed = 0;

      // Import Sleep data
      const sleepFile = zipContent.file("HealthSleep.csv");
      if (sleepFile) {
        const content = await sleepFile.async('text');
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          await supabase.from('sleep_logs').upsert({
            user_id: user.id,
            sleep_date: row.date,
            start_time: row.startTime,
            end_time: row.endTime,
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
          importedStats.sleep++;
        }
      }
      filesProcessed++;
      setProgress((filesProcessed / totalFiles) * 100);

      // Import Resting Heart Rate
      const hrRestFile = zipContent.file("HealthHeartRateRest.csv");
      if (hrRestFile) {
        const content = await hrRestFile.async('text');
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          await supabase.from('heart_rate_rest').upsert({
            user_id: user.id,
            date: row.date,
            time: row.time,
            heart_rate: parseInt(row.heartRate),
            source: 'Runalyze'
          }, {
            ignoreDuplicates: false
          });
          importedStats.restingHR++;
        }
      }
      filesProcessed++;
      setProgress((filesProcessed / totalFiles) * 100);

      // Import HRV
      const hrvFile = zipContent.file("HealthHrv.csv");
      if (hrvFile) {
        const content = await hrvFile.async('text');
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          await supabase.from('hrv_logs').upsert({
            user_id: user.id,
            date: row.date,
            time: row.time,
            hrv: parseFloat(row.hrv),
            metric: row.metric,
            measurement_type: row.measurementType,
            source: row.source
          }, {
            ignoreDuplicates: false
          });
          importedStats.hrv++;
        }
      }
      filesProcessed++;
      setProgress((filesProcessed / totalFiles) * 100);

      // Import Weight/Body Composition
      const weightFile = zipContent.file("HealthWeight.csv");
      if (weightFile) {
        const content = await weightFile.async('text');
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          const timeValue = row.time || '00:00';
          const { error } = await supabase.from('body_composition').upsert({
            user_id: user.id,
            date: row.date,
            time: timeValue,
            weight_kg: parseFloat(row.weight),
            fat_percentage: row.fatPercentage ? parseFloat(row.fatPercentage) : null,
            water_percentage: row.waterPercentage ? parseFloat(row.waterPercentage) : null,
            muscle_percentage: row.musclePercentage ? parseFloat(row.musclePercentage) : null,
            bone_percentage: row.bonePercentage ? parseFloat(row.bonePercentage) : null
          }, {
            onConflict: 'user_id,date,time'
          });
          if (!error) importedStats.weight++;
        }
      }
      filesProcessed++;
      setProgress(100);

      setStats(importedStats);
      toast.success("Import dokončen!");
      onComplete?.();
    } catch (error: any) {
      console.error('Chyba při importu:', error);
      toast.error("Nepodařilo se importovat data");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Kompletní import Runalyze dat
        </CardTitle>
        <CardDescription>
          Importujte všechna zdravotní data ze zálohy najednou
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => document.getElementById('full-import-upload')?.click()}
          disabled={importing}
          size="lg"
        >
          {importing ? "Importuji..." : "Vybrat ZIP archiv"}
        </Button>
        <input
          id="full-import-upload"
          type="file"
          accept=".zip"
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

        {stats && (
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Import úspěšný!</span>
            </div>
            <div className="text-sm space-y-1">
              <div>Spánek: {stats.sleep} záznamů</div>
              <div>Klidový tep: {stats.restingHR} záznamů</div>
              <div>HRV: {stats.hrv} záznamů</div>
              <div>Váha: {stats.weight} záznamů</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
