import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress"; // Assumes standard shadcn Progress
import { Badge } from "@/components/ui/badge";
import { Activity, Battery, Gauge, TrendingUp, Info } from "lucide-react";
import { calculateFitnessMetrics } from "@/utils/fitnessMetrics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AdvancedMetricsProps {
  activities: any[];
  userProfile: any;
}

export const AdvancedMetricsWidget = ({ activities, userProfile }: AdvancedMetricsProps) => {
  const metrics = useMemo(() => {
    // Determine max HR (default 190) and Resting HR (default 60)
    // TODO: Ideally fetch these from profile
    const maxHR = 190; 
    const restingHR = 60;
    
    return calculateFitnessMetrics(activities, maxHR, restingHR, 'male');
  }, [activities, userProfile]);

  // Helper for TSB color
  const getTSBColor = (tsb: number) => {
    if (tsb > 20) return "text-blue-500"; // Tapering / Detraining
    if (tsb > 5) return "text-green-500"; // Fresh / Peak
    if (tsb > -10) return "text-gray-500"; // Neutral
    if (tsb > -30) return "text-orange-500"; // Optimal Training
    return "text-red-500"; // High Fatigue / Overreaching
  };

  const getTSBLabel = (tsb: number) => {
    if (tsb > 25) return "Detrénink (Vysoká čerstvost)";
    if (tsb > 5) return "Ve formě (Čerstvý)";
    if (tsb > -10) return "Vyvážený stav";
    if (tsb > -30) return "Produktivní trénink";
    return "Vysoká únava (Pozor)";
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-5 w-5 text-primary" />
            Pokročilé výpočty (Analýza zátěže)
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Model založený na tepové frekvenci (TRIMP):<br/>
                  ATL = Únava (7 dní)<br/>
                  CTL = Kondice (42 dní)<br/>
                  TSB = Forma (CTL - ATL)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Top Grid: VO2max | Marathon | Fatigue | Fitness | Form */}
        <div className="space-y-4">
          
          {/* VO2 Max */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Activity className="h-4 w-4 text-purple-500" />
              Efektivní VO2max
            </div>
            <Progress value={Math.min(100, (metrics.currentVO2max / 70) * 100)} className="h-2" />
            <div className="text-right font-bold text-sm">{metrics.currentVO2max} ml/kg</div>
          </div>

          {/* Marathon Shape */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Maratónská forma
            </div>
            <Progress value={metrics.marathonShape} className="h-2" />
            <div className="text-right font-bold text-sm">{metrics.marathonShape} %</div>
          </div>

          <div className="h-px bg-border my-2" />

          {/* ATL (Fatigue) */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Battery className="h-4 w-4 text-orange-500" />
              Únava (ATL)
              <span className="text-xs text-muted-foreground font-normal ml-1">7 dní</span>
            </div>
            <Progress value={Math.min(100, (metrics.currentATL / 150) * 100)} className="h-2" />
            <div className="text-right font-bold text-sm">{metrics.currentATL}</div>
          </div>

          {/* CTL (Fitness) */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Activity className="h-4 w-4 text-blue-600" />
              Kondice (CTL)
              <span className="text-xs text-muted-foreground font-normal ml-1">42 dní</span>
            </div>
            <Progress value={Math.min(100, (metrics.currentCTL / 150) * 100)} className="h-2" />
            <div className="text-right font-bold text-sm">{metrics.currentCTL}</div>
          </div>

          {/* TSB (Form) - Custom Visualization */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
             <div className="flex items-center gap-2 font-medium text-sm">
              <Gauge className="h-4 w-4 text-primary" />
              Stresová rovnováha (TSB)
            </div>
            
            {/* Custom Bar for Negative/Positive values */}
            <div className="relative h-2 bg-secondary rounded-full overflow-hidden flex">
               {/* Center marker */}
               <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black/20 z-10" />
               
               {/* The Bar */}
               {metrics.currentTSB >= 0 ? (
                 <div 
                   className="absolute left-1/2 top-0 bottom-0 bg-green-500 transition-all" 
                   style={{ width: `${Math.min(50, metrics.currentTSB)}%` }} 
                 />
               ) : (
                 <div 
                   className="absolute right-1/2 top-0 bottom-0 bg-orange-500 transition-all" 
                   style={{ width: `${Math.min(50, Math.abs(metrics.currentTSB))}%` }} 
                 />
               )}
            </div>

            <div className={`text-right font-bold text-sm ${getTSBColor(metrics.currentTSB)}`}>
               {metrics.currentTSB > 0 ? '+' : ''}{metrics.currentTSB}
            </div>
          </div>
          
           {/* TSB Label Interpretation */}
          <div className="flex justify-end text-xs text-muted-foreground -mt-3">
             {getTSBLabel(metrics.currentTSB)}
          </div>

          <div className="h-px bg-border my-2" />

          {/* Monotony */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              Monotónnost
            </div>
            {/* Monotony scale roughly 0-2 (above 2 is dangerous) */}
            <Progress value={Math.min(100, (metrics.monotony / 2.5) * 100)} className={`h-2 ${metrics.monotony > 2 ? 'bg-red-200 [&>div]:bg-red-500' : ''}`} />
            <div className="text-right font-bold text-sm">{metrics.monotony}</div>
          </div>
          
           {/* Strain */}
          <div className="grid grid-cols-[1.5fr,2fr,1fr] gap-4 items-center">
            <div className="flex items-center gap-2 font-medium text-sm">
              Zátěž tréninku (Strain)
            </div>
             {/* Strain scale roughly 0-4000? */}
            <Progress value={Math.min(100, (metrics.trainingStrain / 4000) * 100)} className="h-2" />
            <div className="text-right font-bold text-sm">{metrics.trainingStrain}</div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};
