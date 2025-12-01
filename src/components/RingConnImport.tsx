import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from "jszip";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportStats {
  sleep: number;
  hrv: number;
  restingHR: number;
  weight: number;
}

export const RingConnImport = ({ onComplete }: { onComplete?: () => void }) => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Prosím nahrajte ZIP soubor z RingConn exportu");
      return;
    }

    setImporting(true);
    setProgress(0);
    setStats(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Musíte být přihlášeni");
        return;
      }

      setProgress(10);

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      setProgress(20);

      const allFiles = Object.keys(zipContent.files);
      console.log('RingConn ZIP files:', allFiles);
      
      const csvFiles = allFiles.filter(name => 
        name.endsWith('.csv') && name.includes('Vital Signs')
      );
      
      console.log('RingConn CSV files found:', csvFiles);

      if (csvFiles.length === 0) {
        toast.error("V ZIP souboru nebyl nalezen Vital Signs CSV soubor");
        return;
      }

      const csvFile = zipContent.files[csvFiles[0]];
      const csvText = await csvFile.async('text');
      
      setProgress(30);

      const lines = csvText.split('\n').filter(line => line.trim());
      console.log('RingConn CSV total lines:', lines.length);
      
      const headers = parseCsvLine(lines[0]);
      console.log('RingConn CSV headers:', headers);
      
      if (lines.length > 1) {
        const firstDataRow = parseCsvLine(lines[1]);
        console.log('RingConn first data row:', firstDataRow);
      }

      const importedStats: ImportStats = { sleep: 0, hrv: 0, restingHR: 0, weight: 0 };
      const totalRows = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const baseProgress = 30 + ((i / totalRows) * 60);
        setProgress(baseProgress);

        // Parse date and time
        const date = row['Date'] || row['date'];
        if (!date) continue;

        // Import Sleep Data
        if (row['Sleep Duration (h)'] || row['Deep Sleep (h)'] || row['Light Sleep (h)'] || row['REM Sleep (h)']) {
          const sleepDuration = parseFloat(row['Sleep Duration (h)'] || '0') * 60;
          const deepSleep = parseFloat(row['Deep Sleep (h)'] || '0') * 60;
          const lightSleep = parseFloat(row['Light Sleep (h)'] || '0') * 60;
          const remSleep = parseFloat(row['REM Sleep (h)'] || '0') * 60;

          if (sleepDuration > 0) {
            const { error } = await supabase
              .from('sleep_logs')
              .upsert({
                user_id: user.id,
                sleep_date: date,
                duration_minutes: Math.round(sleepDuration),
                deep_sleep_minutes: Math.round(deepSleep),
                light_sleep_minutes: Math.round(lightSleep),
                rem_duration_minutes: Math.round(remSleep),
                start_time: row['Bedtime'] || null,
                end_time: row['Wake-up Time'] || null,
              }, {
                onConflict: 'user_id,sleep_date',
                ignoreDuplicates: false
              });

            if (!error) importedStats.sleep++;
          }
        }

        // Import HRV Data
        if (row['HRV'] || row['Avg HRV (ms)']) {
          const hrvValue = parseFloat(row['HRV'] || row['Avg HRV (ms)'] || '0');
          if (hrvValue > 0) {
            const { error } = await supabase
              .from('hrv_logs')
              .upsert({
                user_id: user.id,
                date: date,
                hrv: hrvValue,
                source: 'RingConn',
                metric: 'RMSSD',
              }, {
                onConflict: 'user_id,date',
                ignoreDuplicates: false
              });

            if (!error) importedStats.hrv++;
          }
        }

        // Import Resting Heart Rate
        if (row['Resting HR (bpm)'] || row['Avg Resting HR (bpm)']) {
          const rhr = parseInt(row['Resting HR (bpm)'] || row['Avg Resting HR (bpm)'] || '0');
          if (rhr > 0) {
            const { error } = await supabase
              .from('heart_rate_rest')
              .upsert({
                user_id: user.id,
                date: date,
                heart_rate: rhr,
              }, {
                onConflict: 'user_id,date',
                ignoreDuplicates: false
              });

            if (!error) importedStats.restingHR++;
          }
        }

        // Import Weight Data
        if (row['Weight (kg)']) {
          const weight = parseFloat(row['Weight (kg)']);
          if (weight > 0) {
            const { error } = await supabase
              .from('body_composition')
              .upsert({
                user_id: user.id,
                date: date,
                weight_kg: weight,
              }, {
                onConflict: 'user_id,date',
                ignoreDuplicates: false
              });

            if (!error) importedStats.weight++;
          }
        }
      }

      setProgress(100);
      setStats(importedStats);
      toast.success(`Import dokončen! Spánek: ${importedStats.sleep}, HRV: ${importedStats.hrv}, RHR: ${importedStats.restingHR}, Váha: ${importedStats.weight}`);
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Chyba při importu dat z RingConn");
    } finally {
      setImporting(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          RingConn Import
        </CardTitle>
        <CardDescription>
          Importujte zdravotní data z RingConn exportu (ZIP soubor)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input
            id="ringconn-upload"
            type="file"
            accept=".zip"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
          <label htmlFor="ringconn-upload">
            <Button
              variant="outline"
              className="w-full"
              disabled={importing}
              asChild
            >
              <span className="flex items-center gap-2 cursor-pointer">
                <Upload className="h-4 w-4" />
                {importing ? "Importuji..." : "Nahrát RingConn ZIP"}
              </span>
            </Button>
          </label>
        </div>

        {importing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              Importuji data... {Math.round(progress)}%
            </p>
          </div>
        )}

        {stats && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-semibold">Import dokončen:</p>
                <ul className="text-sm space-y-1">
                  <li>• Spánkových záznamů: {stats.sleep}</li>
                  <li>• HRV měření: {stats.hrv}</li>
                  <li>• Klidový tep: {stats.restingHR}</li>
                  <li>• Váhových měření: {stats.weight}</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-semibold">Jak exportovat data z RingConn:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Otevřete RingConn aplikaci</li>
            <li>Přejděte do Nastavení → Export dat</li>
            <li>Vyberte časové období</li>
            <li>Stáhněte ZIP soubor s exportem</li>
            <li>Nahrajte ho zde</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
