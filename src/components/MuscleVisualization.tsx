import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MuscleGroup {
  name: string;
  lastTrained: Date | null;
  activities: string[];
}

const MUSCLE_ACTIVITY_MAP: Record<string, string[]> = {
  chest: ["WeightTraining", "Workout", "BodyCombat"],
  back: ["WeightTraining", "Workout", "Rowing", "Swim"],
  shoulders: ["WeightTraining", "Workout", "BodyCombat", "Swim"],
  biceps: ["WeightTraining", "Workout", "BodyCombat"],
  triceps: ["WeightTraining", "Workout", "BodyCombat"],
  core: ["WeightTraining", "Workout", "BodyCombat", "Run", "Ride", "Yoga"],
  quads: ["Run", "Ride", "Walk", "Hike", "WeightTraining", "BodyCombat"],
  hamstrings: ["Run", "Ride", "Walk", "Hike", "WeightTraining"],
  glutes: ["Run", "Ride", "Walk", "Hike", "WeightTraining", "BodyCombat"],
  calves: ["Run", "Walk", "Hike", "Ride"],
};

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Hrudník",
  back: "Záda",
  shoulders: "Ramena",
  biceps: "Bicepsy",
  triceps: "Tricepsy",
  core: "Core",
  quads: "Quadricepsy",
  hamstrings: "Hamstringy",
  glutes: "Hýždě",
  calves: "Lýtka",
};

export const MuscleVisualization = () => {
  const [muscleData, setMuscleData] = useState<Record<string, MuscleGroup>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMuscleData();
  }, []);

  const loadMuscleData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch recent activities from all sources
    const [stravaRes, garminRes, bodycombatRes] = await Promise.all([
      supabase
        .from("strava_activities")
        .select("activity_type, start_date")
        .eq("user_id", user.id)
        .gte("start_date", sevenDaysAgo.toISOString()),
      supabase
        .from("garmin_activities")
        .select("activity_type, start_date")
        .eq("user_id", user.id)
        .gte("start_date", sevenDaysAgo.toISOString()),
      supabase
        .from("bodycombat_workouts")
        .select("workout_date")
        .eq("user_id", user.id)
        .gte("workout_date", sevenDaysAgo.toISOString()),
    ]);

    const activities: { type: string; date: Date }[] = [];

    stravaRes.data?.forEach((a) => {
      activities.push({ type: a.activity_type, date: new Date(a.start_date) });
    });

    garminRes.data?.forEach((a) => {
      activities.push({ type: a.activity_type, date: new Date(a.start_date) });
    });

    bodycombatRes.data?.forEach((a) => {
      activities.push({ type: "BodyCombat", date: new Date(a.workout_date) });
    });

    // Calculate last trained date for each muscle group
    const muscleGroups: Record<string, MuscleGroup> = {};

    Object.entries(MUSCLE_ACTIVITY_MAP).forEach(([muscle, activityTypes]) => {
      const relevantActivities = activities.filter((a) =>
        activityTypes.some((type) => a.type.toLowerCase().includes(type.toLowerCase()))
      );

      const lastTrained = relevantActivities.length > 0
        ? relevantActivities.reduce((latest, curr) =>
            curr.date > latest ? curr.date : latest, relevantActivities[0].date)
        : null;

      muscleGroups[muscle] = {
        name: MUSCLE_LABELS[muscle],
        lastTrained,
        activities: [...new Set(relevantActivities.map((a) => a.type))],
      };
    });

    setMuscleData(muscleGroups);
    setLoading(false);
  };

  const getMuscleColor = (muscle: string): string => {
    const data = muscleData[muscle];
    if (!data?.lastTrained) return "hsl(var(--muted))"; // Gray - not trained

    const daysSince = Math.floor(
      (Date.now() - data.lastTrained.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince <= 2) return "hsl(142, 76%, 36%)"; // Green - fresh
    if (daysSince <= 5) return "hsl(48, 96%, 53%)"; // Yellow - moderate
    return "hsl(var(--muted))"; // Gray - needs attention
  };

  const getStatusText = (muscle: string): string => {
    const data = muscleData[muscle];
    if (!data?.lastTrained) return "Netrénováno";

    const daysSince = Math.floor(
      (Date.now() - data.lastTrained.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince === 0) return "Dnes";
    if (daysSince === 1) return "Včera";
    return `Před ${daysSince} dny`;
  };

  const MuscleTooltip = ({ muscle, children }: { muscle: string; children: React.ReactNode }) => (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-semibold">{MUSCLE_LABELS[muscle]}</p>
          <p className="text-muted-foreground">{getStatusText(muscle)}</p>
          {muscleData[muscle]?.activities.length > 0 && (
            <p className="text-xs mt-1">
              {muscleData[muscle].activities.slice(0, 2).join(", ")}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Svalové skupiny</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="animate-pulse text-muted-foreground">Načítám...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Svalové skupiny</CardTitle>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: "hsl(142, 76%, 36%)" }} />
            Čerstvé (0-2 dny)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: "hsl(48, 96%, 53%)" }} />
            Střední (3-5 dnů)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-muted" />
            Odpočaté
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <svg viewBox="0 0 200 320" className="w-full max-w-[280px] mx-auto">
            {/* Head */}
            <circle cx="100" cy="25" r="20" fill="hsl(var(--muted))" opacity="0.5" />
            
            {/* Neck */}
            <rect x="92" y="45" width="16" height="15" fill="hsl(var(--muted))" opacity="0.5" />

            {/* Shoulders */}
            <MuscleTooltip muscle="shoulders">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <ellipse cx="60" cy="70" rx="18" ry="12" fill={getMuscleColor("shoulders")} />
                <ellipse cx="140" cy="70" rx="18" ry="12" fill={getMuscleColor("shoulders")} />
              </g>
            </MuscleTooltip>

            {/* Chest */}
            <MuscleTooltip muscle="chest">
              <path
                d="M 70 65 Q 100 60 130 65 L 125 100 Q 100 105 75 100 Z"
                fill={getMuscleColor("chest")}
                className="cursor-pointer transition-opacity hover:opacity-80"
              />
            </MuscleTooltip>

            {/* Core */}
            <MuscleTooltip muscle="core">
              <rect
                x="78"
                y="100"
                width="44"
                height="55"
                rx="8"
                fill={getMuscleColor("core")}
                className="cursor-pointer transition-opacity hover:opacity-80"
              />
            </MuscleTooltip>

            {/* Biceps */}
            <MuscleTooltip muscle="biceps">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <ellipse cx="48" cy="95" rx="10" ry="22" fill={getMuscleColor("biceps")} />
                <ellipse cx="152" cy="95" rx="10" ry="22" fill={getMuscleColor("biceps")} />
              </g>
            </MuscleTooltip>

            {/* Triceps */}
            <MuscleTooltip muscle="triceps">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <ellipse cx="38" cy="95" rx="8" ry="20" fill={getMuscleColor("triceps")} />
                <ellipse cx="162" cy="95" rx="8" ry="20" fill={getMuscleColor("triceps")} />
              </g>
            </MuscleTooltip>

            {/* Forearms */}
            <rect x="32" y="120" width="12" height="35" rx="4" fill="hsl(var(--muted))" opacity="0.5" />
            <rect x="156" y="120" width="12" height="35" rx="4" fill="hsl(var(--muted))" opacity="0.5" />

            {/* Glutes */}
            <MuscleTooltip muscle="glutes">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <ellipse cx="85" cy="165" rx="15" ry="12" fill={getMuscleColor("glutes")} />
                <ellipse cx="115" cy="165" rx="15" ry="12" fill={getMuscleColor("glutes")} />
              </g>
            </MuscleTooltip>

            {/* Quads */}
            <MuscleTooltip muscle="quads">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <path d="M 72 180 L 68 240 L 88 240 L 92 180 Z" fill={getMuscleColor("quads")} rx="4" />
                <path d="M 108 180 L 112 240 L 132 240 L 128 180 Z" fill={getMuscleColor("quads")} rx="4" />
              </g>
            </MuscleTooltip>

            {/* Hamstrings (behind, shown slightly offset) */}
            <MuscleTooltip muscle="hamstrings">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <rect x="70" y="185" width="16" height="50" rx="4" fill={getMuscleColor("hamstrings")} opacity="0.7" />
                <rect x="114" y="185" width="16" height="50" rx="4" fill={getMuscleColor("hamstrings")} opacity="0.7" />
              </g>
            </MuscleTooltip>

            {/* Calves */}
            <MuscleTooltip muscle="calves">
              <g className="cursor-pointer transition-opacity hover:opacity-80">
                <ellipse cx="78" cy="270" rx="10" ry="25" fill={getMuscleColor("calves")} />
                <ellipse cx="122" cy="270" rx="10" ry="25" fill={getMuscleColor("calves")} />
              </g>
            </MuscleTooltip>

            {/* Feet */}
            <ellipse cx="78" cy="305" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.5" />
            <ellipse cx="122" cy="305" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.5" />
          </svg>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
