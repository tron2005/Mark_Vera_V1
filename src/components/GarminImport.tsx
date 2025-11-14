import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Check } from "lucide-react";
import FitParser from "fit-file-parser";

export const GarminImport = ({ onImportComplete }: { onImportComplete?: () => void }) => {
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    let successCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Musíte být přihlášeni");
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const arrayBuffer = await file.arrayBuffer();
          const fitParser = new FitParser({
            force: true,
            speedUnit: 'km/h',
            lengthUnit: 'km',
            temperatureUnit: 'celsius',
            elapsationUnit: 's',
            mode: 'both'
          });

          const result = await new Promise<any>((resolve, reject) => {
            fitParser.parse(arrayBuffer, (error: any, data: any) => {
              if (error) reject(error);
              else resolve(data);
            });
          });

          // Extract activity data
          const activity = result.activity;
          const sessions = result.sessions || [];
          const records = result.records || [];

          if (!activity || sessions.length === 0) {
            console.warn(`Soubor ${file.name} neobsahuje aktivitu`);
            continue;
          }

          const session = sessions[0];
          
          // Calculate metrics
          const distanceKm = session.total_distance ? session.total_distance / 1000 : 0;
          const durationSeconds = session.total_timer_time || 0;
          const avgHeartRate = session.avg_heart_rate || null;
          const maxHeartRate = session.max_heart_rate || null;
          const calories = session.total_calories || null;
          const elevationGain = session.total_ascent || null;
          const avgSpeed = distanceKm > 0 && durationSeconds > 0 
            ? (distanceKm / (durationSeconds / 3600)) 
            : null;

          // Determine activity type
          let activityType = "workout";
          if (session.sport === "running") activityType = "run";
          else if (session.sport === "cycling") activityType = "ride";
          else if (session.sport === "walking") activityType = "walk";

          // Insert activity into database
          const { error: insertError } = await supabase
            .from("garmin_activities")
            .insert({
              user_id: user.id,
              activity_type: activityType,
              start_date: session.start_time || new Date().toISOString(),
              distance_km: distanceKm,
              duration_seconds: durationSeconds,
              avg_heart_rate: avgHeartRate,
              max_heart_rate: maxHeartRate,
              calories: calories,
              elevation_gain: elevationGain,
              avg_speed_kmh: avgSpeed,
              raw_data: result
            });

          if (insertError) {
            console.error(`Chyba při ukládání ${file.name}:`, insertError);
            continue;
          }

          successCount++;
        } catch (error) {
          console.error(`Chyba při zpracování ${file.name}:`, error);
        }
      }

      setImportedCount(prev => prev + successCount);
      
      if (successCount > 0) {
        toast.success(`Importováno ${successCount} ${successCount === 1 ? 'aktivita' : 'aktivit'} z Garminu`);
        onImportComplete?.();
      } else {
        toast.error("Nepodařilo se importovat žádné aktivity");
      }
    } catch (error) {
      console.error("Chyba při importu:", error);
      toast.error("Chyba při importu FIT souborů");
    } finally {
      setImporting(false);
      // Reset input
      event.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import FIT souborů
        </CardTitle>
        <CardDescription>
          Nahrajte .fit soubory z Garminu, Runalyze nebo jiných zařízení
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".fit"
              multiple
              onChange={handleFileUpload}
              disabled={importing}
              className="hidden"
              id="fit-file-input"
            />
            <label
              htmlFor="fit-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {importing ? "Importuji..." : "Klikněte pro výběr FIT souborů"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Z Garminu, Runalyze nebo jiných fitness aplikací
                </p>
              </div>
            </label>
          </div>

          {importedCount > 0 && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
              <Check className="h-5 w-5" />
              <span>Celkem importováno: {importedCount} aktivit</span>
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Jak získat FIT soubory:</p>
            <div className="space-y-3 ml-2">
              <div>
                <p className="font-medium text-foreground">Z Garminu:</p>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>Připojte zařízení k počítači</li>
                  <li>Najděte složku "Activities" nebo "GARMIN/Activity"</li>
                  <li>Zkopírujte .fit soubory</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-foreground">Z Runalyze:</p>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>Přihlaste se na Runalyze.com</li>
                  <li>Otevřete aktivitu</li>
                  <li>Klikněte na "Export" → "Download .fit"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
