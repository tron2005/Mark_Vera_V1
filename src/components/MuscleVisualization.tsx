import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { RotateCcw, Activity } from "lucide-react";
import { MUSCLE_PATHS, MUSCLE_ACTIVITY_MAP } from "./trainer/muscleData";

interface MuscleStatus {
  lastTrained: Date | null;
  activities: string[];
}

export const MuscleVisualization = () => {
  const [muscleStatus, setMuscleStatus] = useState<Record<string, MuscleStatus>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"front" | "back">("front");

  useEffect(() => {
    loadMuscleData();
  }, []);

  const loadMuscleData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Načtení aktivit (Strava, Garmin, BodyCombat)
    const [stravaRes, garminRes, bodycombatRes] = await Promise.all([
      supabase.from("strava_activities").select("activity_type, start_date").eq("user_id", user.id).gte("start_date", sevenDaysAgo.toISOString()),
      supabase.from("garmin_activities").select("activity_type, start_date").eq("user_id", user.id).gte("start_date", sevenDaysAgo.toISOString()),
      supabase.from("bodycombat_workouts").select("workout_date").eq("user_id", user.id).gte("workout_date", sevenDaysAgo.toISOString()),
    ]);

    const activities: { type: string; date: Date }[] = [];
    stravaRes.data?.forEach(a => activities.push({ type: a.activity_type, date: new Date(a.start_date) }));
    garminRes.data?.forEach(a => activities.push({ type: a.activity_type, date: new Date(a.start_date) }));
    bodycombatRes.data?.forEach(a => activities.push({ type: "BodyCombat", date: new Date(a.workout_date) }));

    const status: Record<string, MuscleStatus> = {};

    Object.keys(MUSCLE_ACTIVITY_MAP).forEach(muscleId => {
      const targetTypes = MUSCLE_ACTIVITY_MAP[muscleId];
      const relevantActivities = activities.filter(a => 
        targetTypes.some(t => a.type.toLowerCase().includes(t.toLowerCase()))
      );

      const lastTrained = relevantActivities.length > 0
        ? relevantActivities.reduce((latest, curr) => curr.date > latest ? curr.date : latest, relevantActivities[0].date)
        : null;

      status[muscleId] = {
        lastTrained,
        activities: [...new Set(relevantActivities.map(a => a.type))]
      };
    });

    setMuscleStatus(status);
    setLoading(false);
  };

  const getMuscleStyle = (muscleId: string) => {
    const data = muscleStatus[muscleId];
    // Untrained / No Data
    if (!data?.lastTrained) return { 
      fill: "hsl(var(--muted-foreground))", 
      opacity: 0.1, 
      stroke: "hsl(var(--foreground))", 
      strokeWidth: 1,
      strokeOpacity: 0.2
    };

    const daysSince = Math.floor((Date.now() - data.lastTrained.getTime()) / (1000 * 60 * 60 * 24));

    // Fresh (0-2 days): Neon Green/Cyan
    if (daysSince <= 2) return { 
      fill: "hsl(142, 76%, 36%)", 
      opacity: 0.9, 
      filter: "drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))", 
      stroke: "hsl(142, 76%, 20%)", 
      strokeWidth: 1 
    };
    
    // Recovery (3-5 days): Yellow/Orange
    if (daysSince <= 5) return { 
      fill: "hsl(48, 96%, 53%)", 
      opacity: 0.7, 
      stroke: "hsl(48, 96%, 30%)", 
      strokeWidth: 1 
    };
    
    // Rested: Muted but visible
    return { 
      fill: "hsl(var(--muted-foreground))", 
      opacity: 0.15, 
      stroke: "hsl(var(--foreground))", 
      strokeWidth: 1,
      strokeOpacity: 0.3
    };
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Analýza biometrie...</div>;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Svalová Mapa 2.0
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(view === "front" ? "back" : "front")}
            className="gap-2 hover:bg-primary/10"
          >
            <RotateCcw className="h-4 w-4" />
            {view === "front" ? "Zadní pohled" : "Přední pohled"}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="relative flex justify-center py-6 min-h-[350px]">
         <TooltipProvider>
            <svg viewBox="0 0 200 320" className="w-full max-w-[280px] drop-shadow-2xl">
                {/* Silhouette / Skeleton Base */}
                <path d="M 100 20 L 100 300" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
                
                {/* Head (Generic Poly) */}
                <path d="M 85 20 L 115 20 L 110 50 L 90 50 Z" fill="hsl(var(--muted))" opacity="0.2" />

                {/* Muscles Render */}
                {MUSCLE_PATHS.filter(m => m.view === view).map((muscle) => {
                    const style = getMuscleStyle(muscle.id);
                    const status = muscleStatus[muscle.id];
                    
                    return (
                        <Tooltip key={`${muscle.view}-${muscle.id}`}>
                            <TooltipTrigger asChild>
                                <path
                                    d={muscle.path}
                                    style={{
                                        transition: "all 0.4s ease-out",
                                        cursor: "pointer",
                                        ...style
                                    }}
                                    className="hover:opacity-100 hover:scale-105 origin-center"
                                />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <div className="text-sm">
                                    <p className="font-bold">{muscle.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {status?.lastTrained 
                                            ? `Naposledy: ${status.lastTrained.toLocaleDateString()}` 
                                            : "Netrénováno (7 dní)"
                                        }
                                    </p>
                                    {status?.activities?.length > 0 && (
                                        <p className="text-[10px] mt-1 text-primary">
                                            {status.activities.slice(0, 2).join(", ")}
                                        </p>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </svg>
         </TooltipProvider>

         {/* Legend */}
         <div className="absolute bottom-2 left-4 flex flex-col gap-2 text-[10px] text-muted-foreground bg-background/80 p-2 rounded backdrop-blur-sm border">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-green-600 shadow-[0_0_4px_rgba(34,197,94,0.8)]"></span>
                <span>Aktivní (0-2 dny)</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-yellow-500"></span>
                <span>Regenerace (3-5)</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-muted border border-border"></span>
                <span>Odpočaté</span>
            </div>
         </div>
      </CardContent>
    </Card>
  );
};