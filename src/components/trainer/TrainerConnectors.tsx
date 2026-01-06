import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { GarminImport } from "../GarminImport";
import { SleepImport } from "../SleepImport";
import { RunalyzeBackupAnalyzer } from "../RunalyzeBackupAnalyzer";
import { RunalyzeFullImport } from "../RunalyzeFullImport";
import { RunalyzeCsvImport } from "../RunalyzeCsvImport";
import { RingConnImport } from "../RingConnImport";
import { BodyCombatTracker } from "../BodyCombatTracker";
import { CalorieImport } from "../CalorieImport";

interface TrainerConnectorsProps {
  stravaConnected: boolean;
  lastSync: Date | null;
  syncing: boolean;
  onSyncStrava: () => void;
  onRefreshData: () => void;
}

export const TrainerConnectors = ({
  stravaConnected,
  lastSync,
  syncing,
  onSyncStrava,
  onRefreshData
}: TrainerConnectorsProps) => {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Stav připojení
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Strava</span>
              {stravaConnected ? (
                <Badge variant="default" className="bg-green-600">Připojeno</Badge>
              ) : (
                <Badge variant="secondary">Nepřipojeno</Badge>
              )}
            </div>
            {stravaConnected && lastSync && (
              <div className="text-xs text-muted-foreground">
                Poslední sync: {lastSync.toLocaleString('cs-CZ')}
              </div>
            )}
            {stravaConnected && (
              <Button 
                onClick={onSyncStrava} 
                disabled={syncing}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {syncing ? "Synchronizuji..." : "Synchronizovat Strava data"}
              </Button>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium">Garmin / Runalyze</span>
              <Badge variant="secondary">FIT soubory</Badge>
            </div>
            {!stravaConnected && (
              <p className="text-sm text-muted-foreground mt-2">
                Připojte své fitness účty v Nastavení pro zobrazení dat a doporučení.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Garmin Import */}
        <GarminImport onImportComplete={onRefreshData} />

        {/* Sleep Import */}
        <SleepImport onImportComplete={onRefreshData} />

        {/* BodyCombat Tracker - Input */}
        <BodyCombatTracker />

        {/* Runalyze Backup Analyzer */}
        <RunalyzeBackupAnalyzer />

        {/* Full Import */}
        <RunalyzeFullImport onComplete={onRefreshData} />

        {/* CSV Import */}
        <RunalyzeCsvImport onComplete={onRefreshData} />

        {/* RingConn Import */}
        <RingConnImport onComplete={onRefreshData} />
        
        {/* Calorie Import */}
        <CalorieImport />
      </div>
    </div>
  );
};
