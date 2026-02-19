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
  activity: number;
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
    console.log('RingConn import started, file:', file);
    
    if (!file) {
      console.log('RingConn: No file selected');
      return;
    }

    console.log('RingConn file name:', file.name);
    if (!file.name.endsWith('.zip')) {
      toast.error("Prosím nahrajte ZIP soubor z RingConn exportu");
      return;
    }

    setImporting(true);
    setProgress(0);
    setStats(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('RingConn: User check, user_id:', user?.id);
      
      if (!user) {
        toast.error("Musíte být přihlášeni");
        return;
      }

      setProgress(10);
      console.log('RingConn: Starting ZIP extraction...');

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      setProgress(20);

      const allFiles = Object.keys(zipContent.files);
      console.log('RingConn ZIP files:', allFiles);

      const importedStats: ImportStats = { sleep: 0, hrv: 0, restingHR: 0, activity: 0 };

      // Process Sleep CSV
      const sleepFiles = allFiles.filter(name => 
        name.endsWith('.csv') && name.includes('Sleep')
      );
      
      console.log('RingConn Sleep CSV files:', sleepFiles);

      for (const sleepFileName of sleepFiles) {
        const sleepCsv = zipContent.files[sleepFileName];
        const sleepText = await sleepCsv.async('text');
        const sleepLines = sleepText.split('\n').filter(line => line.trim());
        
        console.log('Sleep CSV lines:', sleepLines.length);
        
        if (sleepLines.length < 2) continue;

        // Sleep CSV: Start Time,End Time,Falling Asleep Time,Wake-up time,Sleep Time Ratio(%),Time Asleep(min),Sleep Stages - Awake(min),Sleep Stages - REM(min),Sleep Stages - Light Sleep(min),Sleep Stages - Deep Sleep(min)
        for (let i = 1; i < sleepLines.length; i++) {
          const values = parseCsvLine(sleepLines[i]);
          if (values.length < 10) continue;

          const startTime = values[0];
          const endTime = values[1];
          const sleepDuration = parseFloat(values[5]) || 0;
          const awake = parseFloat(values[6]) || 0;
          const rem = parseFloat(values[7]) || 0;
          const light = parseFloat(values[8]) || 0;
          const deep = parseFloat(values[9]) || 0;

          if (!startTime || sleepDuration === 0) continue;

          const sleepDate = startTime.split(' ')[0];

          const { error } = await supabase
            .from('sleep_logs')
            .upsert({
              user_id: user.id,
              sleep_date: sleepDate,
              duration_minutes: Math.round(sleepDuration),
              rem_duration_minutes: Math.round(rem),
              awake_duration_minutes: Math.round(awake),
              deep_sleep_minutes: Math.round(deep),
              light_sleep_minutes: Math.round(light),
              start_time: startTime,
              end_time: endTime,
              source: 'RingConn'
            }, {
              onConflict: 'user_id,sleep_date'
            });

          if (!error) importedStats.sleep++;
          setProgress(30 + Math.round((i / sleepLines.length) * 30));
        }
      }

      // Process Vital Signs CSV
      const vitalFiles = allFiles.filter(name => 
        name.endsWith('.csv') && name.includes('Vital')
      );

      console.log('RingConn Vital Signs CSV files:', vitalFiles);

      for (const vitalFileName of vitalFiles) {
        const vitalCsv = zipContent.files[vitalFileName];
        const vitalText = await vitalCsv.async('text');
        const vitalLines = vitalText.split('\n').filter(line => line.trim());
        
        console.log('Vital Signs CSV lines:', vitalLines.length);
        
        if (vitalLines.length < 2) continue;

        // Vital Signs CSV: Date,Avg. Heart Rate(bpm),Min. Heart Rate(bpm),Max. Heart Rate(bpm),Avg. Spo2(%),Min. Spo2(%),Max. Spo2(%),Avg. HRV(ms),Min. HRV(ms),Max. HRV(ms)
        for (let i = 1; i < vitalLines.length; i++) {
          const values = parseCsvLine(vitalLines[i]);
          if (values.length < 10) continue;

          const date = values[0];
          const minHR = parseFloat(values[2]) || 0;
          const avgHRV = parseFloat(values[7]) || 0;

          if (!date) continue;

          // Import HRV
          if (avgHRV > 0) {
            const { error } = await supabase
              .from('hrv_logs')
              .upsert({
                user_id: user.id,
                date: date,
                hrv: avgHRV,
                source: 'RingConn'
              }, {
                onConflict: 'user_id,date'
              });

            if (!error) importedStats.hrv++;
          }

          // Import Resting Heart Rate
          if (minHR > 0) {
            const { error } = await supabase
              .from('heart_rate_rest')
              .upsert({
                user_id: user.id,
                date: date,
                heart_rate: Math.round(minHR),
                source: 'RingConn'
              }, {
                onConflict: 'user_id,date'
              });

            if (!error) importedStats.restingHR++;
          }

          setProgress(50 + Math.round((i / vitalLines.length) * 20));
        }
      }

      // ========== Process Activity CSV ==========
      const activityFiles = allFiles.filter(name => 
        name.endsWith('.csv') && name.toLowerCase().includes('activity')
      );
      console.log('RingConn Activity CSV files:', activityFiles);

      for (const activityFileName of activityFiles) {
        const activityCsv = zipContent.files[activityFileName];
        const activityText = await activityCsv.async('text');
        const activityLines = activityText.split('\n').filter(line => line.trim());
        
        console.log('Activity CSV lines:', activityLines.length);
        console.log('Activity CSV header:', activityLines[0]);
        
        if (activityLines.length < 2) continue;

        // Activity CSV columns: Date,Steps,Calories(kcal)
        for (let i = 1; i < activityLines.length; i++) {
          const values = parseCsvLine(activityLines[i]);
          console.log(`Activity row ${i}:`, values);
          
          if (values.length < 3) continue;

          const date = values[0];
          const steps = parseInt(values[1]) || 0;
          const calories = parseInt(values[2]) || 0;

          if (!date || (steps === 0 && calories === 0)) continue;

          const { error } = await supabase
            .from('daily_activity' as any)
            .upsert({
              user_id: user.id,
              date: date,
              steps: steps,
              calories: calories,
              source: 'RingConn'
            }, {
              onConflict: 'user_id,date,source'
            });

          if (error) {
            console.error('Activity insert error:', error);
          } else {
            importedStats.activity++;
          }
          setProgress(70 + Math.round((i / activityLines.length) * 25));
        }
      }

      setProgress(100);
      setStats(importedStats);

      const totalImported = importedStats.sleep + importedStats.hrv + importedStats.restingHR + importedStats.activity;

      if (totalImported > 0) {
        toast.success(`Import dokončen! Spánek: ${importedStats.sleep}, HRV: ${importedStats.hrv}, RHR: ${importedStats.restingHR}, Aktivita: ${importedStats.activity}`);
      } else {
        toast.error("CSV soubory byly načteny, ale nenašel jsem žádná nová použitelná data k importu.");
      }
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
                  <li>• Denní aktivita (kroky/kalorie): {stats.activity}</li>
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
