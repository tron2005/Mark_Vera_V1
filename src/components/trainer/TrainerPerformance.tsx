import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, TrendingUp, Sparkles, Moon, Cloud, Loader2, Dumbbell, Footprints, Bike, Waves, User, Brain, Zap, ChevronRight } from "lucide-react";
import { ActivityDetailDialog } from "../ActivityDetailDialog";

import { FitnessStats } from "../FitnessStats";
import { SleepCharts } from "../SleepCharts";
import { AdvancedMetricsWidget } from "./AdvancedMetricsWidget";
import { HealthDataCharts } from "../HealthDataCharts";
import { ActivityCharts } from "../ActivityCharts";
import { WeightChart } from "../WeightChart";
import { BodyCompositionChart } from "../BodyCompositionChart";
import { BodyCombatStats } from "../BodyCombatStats";
import { CalorieTracker } from "../CalorieTracker";
import { RaceGoalsWidget } from "../RaceGoalsWidget";
import { WeeklyOverview } from "../WeeklyOverview";

import { MuscleVisualization } from "../MuscleVisualization";
import { WeightLossPlan } from "../WeightLossPlan";

import { MotivationalQuote } from "../MotivationalQuote";

interface TrainerPerformanceProps {
  userProfile: any;
  stravaConnected: boolean;
  activities: any[];
  showStats: boolean;
  setShowStats: (show: boolean) => void;

  // Dialog States
  summaryDialog: { open: boolean; type: string; content: string; loading: boolean };
  setSummaryDialog: React.Dispatch<React.SetStateAction<{ open: boolean; type: string; content: string; loading: boolean }>>;
  generateSummary: (type: 'sleep' | 'last_workout' | 'weekly_overview') => void;

  weatherDialog: { open: boolean; data: any; recommendation: string; loading: boolean };
  setWeatherDialog: React.Dispatch<React.SetStateAction<{ open: boolean; data: any; recommendation: string; loading: boolean }>>;
  getWeatherRecommendation: () => void;
}

export const TrainerPerformance = ({
  userProfile,
  stravaConnected,
  activities,
  showStats,
  setShowStats,
  summaryDialog,
  setSummaryDialog,
  generateSummary,
  weatherDialog,
  setWeatherDialog,
  getWeatherRecommendation
}: TrainerPerformanceProps) => {
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const getSummaryTitle = () => {
    switch (summaryDialog.type) {
      case 'sleep': return 'AI Shrnutí spánku';
      case 'last_workout': return 'AI Shrnutí posledního tréninku';
      case 'weekly_overview': return 'AI Týdenní přehled';
      default: return 'AI Shrnutí';
    }
  };

  const getActivityInfo = (type: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('run') || t.includes('jog')) return { label: 'Běh', badge: 'activity-badge-run', icon: Activity };
    if (t.includes('walk') || t.includes('hike')) return { label: 'Chůze', badge: 'activity-badge-walk', icon: Footprints };
    if (t.includes('ride') || t.includes('cycling') || t.includes('bike')) return { label: 'Cyklistika', badge: 'activity-badge-ride', icon: Bike };
    if (t.includes('weight') || t.includes('strength') || t.includes('crossfit')) return { label: 'Posilování', badge: 'activity-badge-weight', icon: Dumbbell };
    if (t.includes('swim')) return { label: 'Plavání', badge: 'activity-badge-swim', icon: Waves };
    return { label: type, badge: 'activity-badge-default', icon: Activity };
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* User Profile */}
        {userProfile && (
          <Card className="card-hover animate-fade-in animate-fade-in-delay-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Váš profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userProfile.weight_kg && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-muted-foreground">Váha</span>
                  <span className="stat-value">{userProfile.weight_kg} kg</span>
                </div>
              )}
              {userProfile.height_cm && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-muted-foreground">Výška</span>
                  <span className="stat-value">{userProfile.height_cm} cm</span>
                </div>
              )}
              {userProfile.age && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-muted-foreground">Věk</span>
                  <span className="stat-value">{userProfile.age} let</span>
                </div>
              )}
              {userProfile.bmi && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-muted-foreground">BMI</span>
                  <span className="stat-value">{Number(userProfile.bmi).toFixed(1)}</span>
                </div>
              )}
              {userProfile.bmr && (
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="font-medium text-muted-foreground">BMR</span>
                  <span className="stat-value">{Math.round(userProfile.bmr)} kcal/den</span>
                </div>
              )}
              {!userProfile.weight_kg && !userProfile.height_cm && !userProfile.age && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    💡 Doplňte svůj profil v Nastavení pro přesnější analýzy a doporučení.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Coach Section */}
        <Card className="card-hover animate-fade-in animate-fade-in-delay-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              AI Trenér
            </CardTitle>
            <CardDescription>
              Ptejte se asistenta na tréninkové rady v záložce Chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Váš asistent má přístup k vašim fitness datům a může:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Moon className="h-3.5 w-3.5 text-indigo-500" /> <span>Analyzovat kvalitu spánku</span></li>
              <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-green-500" /> <span>Vyhodnotit vaše tréninky</span></li>
              <li className="flex items-center gap-2"><Cloud className="h-3.5 w-3.5 text-sky-500" /> <span>Doporučit trénink podle počasí</span></li>
              <li className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-red-500" /> <span>Sledovat zdravotní stav (bolesti, únava)</span></li>
              <li className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-500" /> <span>Poskytovat personalizované sportovní rady</span></li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Sumáře a analýzy
          </CardTitle>
          <CardDescription>
            Získejte inteligentní shrnutí vašich dat s doporučeními a analýzou trendů
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => generateSummary('sleep')}
              disabled={summaryDialog.loading}
              className="w-full"
            >
              {summaryDialog.loading && summaryDialog.type === 'sleep' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              Shrnutí spánku
            </Button>
            <Button
              variant="outline"
              onClick={() => generateSummary('last_workout')}
              disabled={summaryDialog.loading}
              className="w-full"
            >
              {summaryDialog.loading && summaryDialog.type === 'last_workout' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Activity className="mr-2 h-4 w-4" />
              )}
              Poslední trénink
            </Button>
            <Button
              variant="outline"
              onClick={() => generateSummary('weekly_overview')}
              disabled={summaryDialog.loading}
              className="w-full"
            >
              {summaryDialog.loading && summaryDialog.type === 'weekly_overview' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              Týdenní přehled
            </Button>
            <Button
              onClick={getWeatherRecommendation}
              disabled={weatherDialog.loading}
              className="w-full"
            >
              {weatherDialog.loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="mr-2 h-4 w-4" />
              )}
              Počasí pro běh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      {stravaConnected && activities.length > 0 && (
        <>
          <Card className="animate-fade-in animate-fade-in-delay-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-500/10">
                      <Activity className="h-4 w-4 text-green-600" />
                    </div>
                    Poslední aktivity ze Stravy
                  </CardTitle>
                  <CardDescription>
                    Vaše nedávné tréninky a výkony
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowStats(!showStats)}
                  className="transition-all hover:border-primary/50"
                >
                  {showStats ? "Skrýt statistiky" : "Zobrazit statistiky"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activities.slice(0, 5).map((activity, index) => {
                  const info = getActivityInfo(activity.type);
                  const IconComponent = info.icon;
                  return (
                    <div
                      key={activity.id}
                      className="activity-item p-3 rounded-lg cursor-pointer group"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-1.5 rounded-lg ${info.badge.replace('activity-badge-', 'bg-').split(' ')[0]}`} style={{ background: 'inherit' }}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="font-medium group-hover:text-primary transition-colors">{activity.name}</h3>
                            <div className="text-sm text-muted-foreground">
                              <span>{info.label}</span> · <span>{new Date(activity.start_date).toLocaleDateString('cs-CZ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`activity-badge ${info.badge}`}>{info.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap ml-10">
                        <span className="font-semibold text-foreground">{(activity.distance / 1000).toFixed(2)} km</span>
                        <span>{Math.round(activity.moving_time / 60)} min</span>
                        {activity.average_heartrate && (
                          <span className="flex items-center gap-1 text-red-500">
                            <Heart className="h-3 w-3" />
                            <span>{Math.round(activity.average_heartrate)} bpm</span>
                          </span>
                        )}
                        {activity.calories && (
                          <span className="font-medium">🔥 {Math.round(activity.calories)} kcal</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {showStats && <FitnessStats activities={activities} />}
        </>
      )}

      {/* Advanced Metrics (Runalyze Style) */}
      {stravaConnected && activities.length > 0 && (
        <AdvancedMetricsWidget activities={activities} userProfile={userProfile} />
      )}

      {/* Sleep Charts */}
      <SleepCharts />

      {/* Health Data Charts */}
      <HealthDataCharts />

      {/* Activity Charts (Steps, Calories from RingConn) */}
      <ActivityCharts />

      {/* Weight Chart */}
      <WeightChart />

      {/* Body Composition Chart - Fat/Muscle/Water */}
      <BodyCompositionChart />

      {/* BodyCombat Stats */}
      <BodyCombatStats />

      {/* Calorie Tracker */}
      <CalorieTracker />

      {/* Race Goals Widget */}
      <RaceGoalsWidget />

      {/* Muscle Visualization */}
      <MuscleVisualization />

      {/* Weight Loss Plan */}
      <WeightLossPlan />



      {/* Longevity Card */}


      {/* Weekly Overview */}
      <WeeklyOverview />

      {/* Summary Dialog */}
      <Dialog open={summaryDialog.open} onOpenChange={(open) => setSummaryDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {getSummaryTitle()}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {summaryDialog.loading ? (
              <div className="flex items-center justify-center py-8">
                <Activity className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Generuji AI analýzu...</span>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-line">{summaryDialog.content}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Weather Dialog */}
      <Dialog open={weatherDialog.open} onOpenChange={(open) => setWeatherDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Počasí a doporučení pro běh
            </DialogTitle>
          </DialogHeader>

          {weatherDialog.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám počasí...</span>
            </div>
          ) : weatherDialog.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <img
                  src={`https://openweathermap.org/img/wn/${weatherDialog.data.icon}@2x.png`}
                  alt={weatherDialog.data.description}
                  className="w-16 h-16"
                />
                <div className="flex-1">
                  <div className="text-2xl font-bold">{weatherDialog.data.temp}°C</div>
                  <div className="text-sm text-muted-foreground">
                    Pocitově {weatherDialog.data.feelsLike}°C
                  </div>
                  <div className="text-sm capitalize">{weatherDialog.data.description}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground">Vlhkost</div>
                  <div className="text-lg font-semibold">{weatherDialog.data.humidity}%</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground">Vítr</div>
                  <div className="text-lg font-semibold">{weatherDialog.data.windSpeed} m/s</div>
                </div>
              </div>

              {weatherDialog.data.rain > 0 && (
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xs text-blue-900 dark:text-blue-100">Déšť (1h)</div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {weatherDialog.data.rain} mm
                  </div>
                </div>
              )}

              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Doporučení trenéra:
                </h3>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-line">{weatherDialog.recommendation}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {/* Activity Detail Dialog */}
      <ActivityDetailDialog
        activity={selectedActivity}
        open={!!selectedActivity}
        onOpenChange={(open) => !open && setSelectedActivity(null)}
      />
    </div>
  );
};
