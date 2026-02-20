import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, RefreshCw, Loader2, Link2, Clock } from "lucide-react";
import { GarminImport } from "../GarminImport";
import { SleepImport } from "../SleepImport";
import { RunalyzeBackupAnalyzer } from "../RunalyzeBackupAnalyzer";
import { RunalyzeFullImport } from "../RunalyzeFullImport";
import { RunalyzeCsvImport } from "../RunalyzeCsvImport";
import { RingConnImport } from "../RingConnImport";
import { BodyCombatTracker } from "../BodyCombatTracker";
import { CalorieImport } from "../CalorieImport";
import { AboutCard } from "./AboutCard";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

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
        <Card className="card-hover animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <Heart className="h-4 w-4 text-red-500" />
              </div>
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

            {/* Poslední synchronizace - výrazné zobrazení */}
            {stravaConnected && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>Poslední synchronizace</span>
                </div>
                {lastSync ? (
                  <>
                    <div className="text-base font-semibold text-foreground">
                      {lastSync.toLocaleString('cs-CZ', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(lastSync, { addSuffix: true, locale: cs })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Ještě nebyla provedena synchronizace
                  </div>
                )}
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
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="animate-sync-pulse">Synchronizuji...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Synchronizovat Strava data
                  </>
                )}
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

        {/* About & Roadmap */}
        <div className="md:col-span-2">
          <AboutCard />
        </div>
      </div>
    </div>
  );
};
