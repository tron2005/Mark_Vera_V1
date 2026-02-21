import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Target, Calendar, CheckCircle, Pause, Play, Trash2,
  ChevronDown, ChevronUp, Dumbbell, Footprints, Moon, Bike, Loader2,
} from "lucide-react";

type Session = {
  day: string;
  type: string;
  description?: string;
  duration_min?: number;
  exercises?: string[];
};

type Phase = {
  name: string;
  weeks: number;
  description?: string;
  weekly_sessions: Session[];
};

type PlanData = {
  phases: Phase[];
  sessions_per_week?: number;
  total_weeks?: number;
};

type TrainingPlan = {
  id: string;
  title: string;
  goal: string;
  start_date: string;
  end_date?: string;
  status: "active" | "paused" | "completed";
  plan_data?: PlanData;
  notes?: string;
  created_at: string;
};

const SESSION_ICONS: Record<string, React.ReactNode> = {
  "Běh": <Footprints className="h-3.5 w-3.5" />,
  "Cyklo": <Bike className="h-3.5 w-3.5" />,
  "Síla": <Dumbbell className="h-3.5 w-3.5" />,
  "Odpočinek": <Moon className="h-3.5 w-3.5" />,
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active:    { label: "Aktivní",    variant: "default"   },
  paused:    { label: "Pozastaveno", variant: "secondary" },
  completed: { label: "Dokončeno",  variant: "outline"   },
};

function getDayOfWeek(): string {
  return ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"][new Date().getDay()];
}

function getWeeksSinceStart(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function getCurrentPhase(plan: TrainingPlan): { phase: Phase | null; weekInPhase: number } {
  if (!plan.plan_data?.phases?.length) return { phase: null, weekInPhase: 0 };
  const weeksSinceStart = getWeeksSinceStart(plan.start_date);
  let cumulative = 0;
  for (const phase of plan.plan_data.phases) {
    if (weeksSinceStart < cumulative + phase.weeks) {
      return { phase, weekInPhase: weeksSinceStart - cumulative + 1 };
    }
    cumulative += phase.weeks;
  }
  return { phase: plan.plan_data.phases[plan.plan_data.phases.length - 1], weekInPhase: plan.plan_data.phases[plan.plan_data.phases.length - 1].weeks };
}

function getTodaySession(plan: TrainingPlan): Session | null {
  const { phase } = getCurrentPhase(plan);
  if (!phase) return null;
  const today = getDayOfWeek();
  return phase.weekly_sessions.find((s) => s.day === today) || null;
}

export function TrainerPlans() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPlans();

    const channel = supabase
      .channel("training_plans_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "training_plans" }, loadPlans)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPlans = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setPlans((data || []) as TrainingPlan[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: TrainingPlan["status"]) => {
    const { error } = await supabase.from("training_plans").update({ status }).eq("id", id);
    if (error) toast.error("Chyba: " + error.message);
    else {
      toast.success(status === "completed" ? "Plán dokončen!" : status === "paused" ? "Plán pozastaven" : "Plán obnoven");
      loadPlans();
    }
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("training_plans").delete().eq("id", id);
    if (error) toast.error("Chyba: " + error.message);
    else { toast.success("Plán smazán"); loadPlans(); }
  };

  const togglePhases = (planId: string) => {
    setExpandedPhases((prev) => ({ ...prev, [planId]: !prev[planId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active" || p.status === "paused");
  const completedPlans = plans.filter((p) => p.status === "completed");

  if (plans.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Tréninkové plány</h2>
          <p className="text-muted-foreground">AI-generované plány na míru podle tvých závodů a kondice.</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <p className="font-medium">Zatím nemáš žádný plán</p>
              <p className="text-sm text-muted-foreground mt-1">
                Řekni Markovi v chatu například:
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="p-2 bg-muted rounded-md inline-block">
                „Připrav mi 8týdenní plán na Gladiator Run 15. dubna."
              </div>
              <div className="block p-2 bg-muted rounded-md inline-block">
                „Chci plán pro posilování – 3× týdně, cíl: síla a hypertrofie."
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Mark zohledí tvoji kondici (CTL/ATL/TSB), závody, věk a zdravotní omezení.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Tréninkové plány</h2>
        <p className="text-muted-foreground">AI-generované plány na míru.</p>
      </div>

      {/* Aktivní + pozastavené plány */}
      {activePlans.map((plan) => {
        const { phase, weekInPhase } = getCurrentPhase(plan);
        const todaySession = getTodaySession(plan);
        const statusInfo = STATUS_LABELS[plan.status];
        const phasesExpanded = expandedPhases[plan.id];
        const endDateStr = plan.end_date
          ? new Date(plan.end_date).toLocaleDateString("cs-CZ")
          : null;
        const daysLeft = plan.end_date
          ? Math.max(0, Math.ceil((new Date(plan.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

        return (
          <Card key={plan.id} className={plan.status === "paused" ? "opacity-70" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{plan.goal}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {plan.status === "active" && (
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Pozastavit" onClick={() => updateStatus(plan.id, "paused")}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {plan.status === "paused" && (
                    <Button size="icon" variant="outline" className="h-7 w-7" title="Obnovit" onClick={() => updateStatus(plan.id, "active")}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="outline" className="h-7 w-7" title="Dokončit" onClick={() => updateStatus(plan.id, "completed")}>
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7 text-destructive hover:text-destructive" title="Smazat" onClick={() => deletePlan(plan.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Start: {new Date(plan.start_date).toLocaleDateString("cs-CZ")}
                </span>
                {endDateStr && (
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Konec: {endDateStr} {daysLeft !== null && `(za ${daysLeft} dní)`}
                  </span>
                )}
                {phase && (
                  <span className="font-medium text-foreground">
                    Fáze: {phase.name} (týden {weekInPhase}/{phase.weeks})
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Dnešní trénink */}
              {todaySession && (
                <div className={`rounded-lg p-3 border-l-4 ${
                  todaySession.type === "Odpočinek"
                    ? "border-muted bg-muted/30"
                    : "border-primary bg-primary/5"
                }`}>
                  <div className="flex items-center gap-2 font-medium text-sm">
                    {SESSION_ICONS[todaySession.type] || <Target className="h-3.5 w-3.5" />}
                    Dnes ({getDayOfWeek()}): {todaySession.type}
                    {todaySession.duration_min && (
                      <span className="font-normal text-muted-foreground">· {todaySession.duration_min} min</span>
                    )}
                  </div>
                  {todaySession.description && (
                    <p className="text-xs text-muted-foreground mt-1">{todaySession.description}</p>
                  )}
                  {todaySession.exercises && todaySession.exercises.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {todaySession.exercises.map((ex, i) => <li key={i}>• {ex}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Přehled fází */}
              {plan.plan_data?.phases && plan.plan_data.phases.length > 0 && (
                <div>
                  <button
                    onClick={() => togglePhases(plan.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {phasesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {phasesExpanded ? "Skrýt plán" : `Zobrazit plán (${plan.plan_data.phases.length} fáze)`}
                  </button>

                  {phasesExpanded && (
                    <div className="mt-3 space-y-3">
                      {plan.plan_data.phases.map((ph, phIndex) => (
                        <div key={phIndex} className={`rounded-lg border p-3 ${phase?.name === ph.name ? "border-primary/50 bg-primary/5" : ""}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">{ph.name}</span>
                            <span className="text-xs text-muted-foreground">({ph.weeks} týdny)</span>
                            {phase?.name === ph.name && <Badge variant="default" className="text-xs py-0">Aktuální</Badge>}
                          </div>
                          {ph.description && <p className="text-xs text-muted-foreground mb-2">{ph.description}</p>}
                          <div className="space-y-1">
                            {ph.weekly_sessions.map((s, si) => (
                              <div key={si} className="flex items-start gap-2 text-xs">
                                <span className="text-muted-foreground w-16 shrink-0">{s.day}:</span>
                                <span className="flex items-center gap-1">
                                  {SESSION_ICONS[s.type]}
                                  <span className={s.type === "Odpočinek" ? "text-muted-foreground" : ""}>{s.type}</span>
                                  {s.duration_min && <span className="text-muted-foreground">· {s.duration_min} min</span>}
                                  {s.description && <span className="text-muted-foreground">– {s.description}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {plan.notes && (
                <p className="text-xs text-muted-foreground italic border-t pt-2">📝 {plan.notes}</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Dokončené plány */}
      {completedPlans.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Dokončené</p>
          {completedPlans.map((plan) => (
            <Card key={plan.id} className="opacity-60">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {plan.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{plan.goal}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => deletePlan(plan.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
