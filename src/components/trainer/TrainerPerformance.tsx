import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, TrendingUp, Sparkles, Moon, Cloud, Loader2 } from "lucide-react";

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

  const getSummaryTitle = () => {
    switch (summaryDialog.type) {
      case 'sleep': return 'AI Shrnutí spánku';
      case 'last_workout': return 'AI Shrnutí posledního tréninku';
      case 'weekly_overview': return 'AI Týdenní přehled';
      default: return 'AI Shrnutí';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* User Profile */}
        {userProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Váš profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userProfile.weight_kg && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Váha</span>
                  <span className="text-lg font-bold">{userProfile.weight_kg} kg</span>
                </div>
              )}
              {userProfile.height_cm && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Výška</span>
                  <span className="text-lg font-bold">{userProfile.height_cm} cm</span>
                </div>
              )}
              {userProfile.age && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Věk</span>
                  <span className="text-lg font-bold">{userProfile.age} let</span>
                </div>
              )}
              {userProfile.bmi && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">BMI</span>
                  <span className="text-lg font-bold">{Number(userProfile.bmi).toFixed(1)}</span>
                </div>
              )}
              {userProfile.bmr && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">BMR</span>
                  <span className="text-lg font-bold">{Math.round(userProfile.bmr)} kcal/den</span>
                </div>
              )}
              {!userProfile.weight_kg && !userProfile.height_cm && !userProfile.age && (
                <p className="text-sm text-muted-foreground">
                  Profil se doplní automaticky ze Stravy nebo můžete přidat údaje v Nastavení.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* AI Coach Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
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
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Analyzovat kvalitu spánku</li>
              <li>Vyhodnotit vaše tréninky</li>
              <li>Doporučit trénink podle počasí</li>
              <li>Sledovat zdravotní stav (bolesti, únava)</li>
              <li>Poskytovat personalizované sportovní rady</li>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Poslední aktivity ze Stravy
                  </CardTitle>
                  <CardDescription>
                    Vaše nedávné tréninky a výkony
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowStats(!showStats)}
                >
                  {showStats ? "Skrýt statistiky" : "Zobrazit statistiky"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium">{activity.name}</h3>
                        <div className="text-sm text-muted-foreground">
                          {activity.type} · {new Date(activity.start_date).toLocaleDateString('cs-CZ')}
                        </div>
                      </div>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="font-medium">{(activity.distance / 1000).toFixed(2)} km</span>
                      <span>{Math.round(activity.moving_time / 60)} min</span>
                      {activity.average_heartrate && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {Math.round(activity.average_heartrate)} bpm
                        </span>
                      )}
                      {activity.calories && (
                        <span>{Math.round(activity.calories)} kcal</span>
                      )}
                    </div>
                  </div>
                ))}
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
    </div>
  );
};
