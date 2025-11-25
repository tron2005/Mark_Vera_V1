import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Heart, TrendingUp, Calendar, Sparkles, Moon, Cloud, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FitnessStats } from "./FitnessStats";
import { GarminImport } from "./GarminImport";
import { SleepImport } from "./SleepImport";
import { SleepCharts } from "./SleepCharts";
import { RunalyzeBackupAnalyzer } from "./RunalyzeBackupAnalyzer";
import { RunalyzeFullImport } from "./RunalyzeFullImport";
import { HealthDataCharts } from "./HealthDataCharts";
import { BodyCombatTracker } from "./BodyCombatTracker";
import { WeightChart } from "./WeightChart";
import { BodyCombatStats } from "./BodyCombatStats";
import { CalorieTracker } from "./CalorieTracker";
import { RaceGoalsWidget } from "./RaceGoalsWidget";
import { WeeklyOverview } from "./WeeklyOverview";

export const FitnessTrainer = () => {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [garminConnected, setGarminConnected] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; type: string; content: string; loading: boolean }>({
    open: false,
    type: '',
    content: '',
    loading: false
  });
  const [weatherDialog, setWeatherDialog] = useState<{ open: boolean; data: any; recommendation: string; loading: boolean }>({
    open: false,
    data: null,
    recommendation: '',
    loading: false
  });

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("strava_refresh_token, garmin_refresh_token, weight_kg, age, height_cm, bmi, bmr")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setStravaConnected(!!profile.strava_refresh_token);
      setGarminConnected(!!profile.garmin_refresh_token);
      setUserProfile(profile);
      
      if (profile.strava_refresh_token) {
        // Load from database
        loadStravaActivitiesFromDB();
        loadLastSyncTime();
      }
      
      // Always try to load Garmin activities (from manual imports)
      loadGarminActivities();
    }
    setLoading(false);
  };

  const loadLastSyncTime = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("strava_sync_log")
      .select("last_sync_at")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setLastSync(new Date(data.last_sync_at));
    }
  };

  const loadStravaActivitiesFromDB = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("strava_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const stravaActivities = (data || []).map((activity: any) => ({
        id: activity.id,
        name: activity.name,
        type: activity.activity_type,
        start_date: activity.start_date,
        distance: activity.distance_meters,
        moving_time: activity.moving_time_seconds,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: activity.calories,
        total_elevation_gain: activity.total_elevation_gain,
        source: 'strava'
      }));

      setActivities(prev => {
        const garminActivities = prev.filter(a => a.source === 'garmin');
        return [...stravaActivities, ...garminActivities].sort((a, b) => 
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
      });
    } catch (error: any) {
      console.error("Chyba při načítání Strava aktivit z DB:", error);
    }
  };

  const syncStravaActivities = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-strava-activities', {
        body: { per_page: 100 }
      });

      if (error) {
        // Check if it's a rate limit error
        if (error.message?.includes('rate limit') || error.message?.includes('Rate Limit')) {
          toast.error("Strava API rate limit překročen. Zkuste to prosím za 15 minut.");
          return;
        }
        throw error;
      }
      
      // Check if data contains rate limit error
      if (data?.rateLimitExceeded) {
        toast.error(data.error || "Strava API rate limit překročen. Zkuste to prosím za 15 minut.");
        return;
      }
      
      if (data?.synced) {
        toast.success(`Synchronizováno ${data.activities?.length || 0} aktivit ze Stravy`);
        await loadStravaActivitiesFromDB();
        await loadLastSyncTime();
      }
    } catch (error: any) {
      console.error("Chyba při synchronizaci aktivit:", error);
      toast.error("Nepodařilo se synchronizovat aktivity ze Stravy");
    } finally {
      setSyncing(false);
    }
  };

  const loadGarminActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("garmin_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      
      // Merge Garmin activities with Strava activities
      const garminActivities = (data || []).map((activity: any) => ({
        id: activity.id,
        name: `Garmin ${activity.activity_type}`,
        type: activity.activity_type,
        start_date: activity.start_date,
        distance: activity.distance_km * 1000, // convert to meters
        moving_time: activity.duration_seconds,
        average_heartrate: activity.avg_heart_rate,
        max_heartrate: activity.max_heart_rate,
        calories: activity.calories,
        total_elevation_gain: activity.elevation_gain,
        source: 'garmin'
      }));

      setActivities(prev => [...prev, ...garminActivities].sort((a, b) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      ));
    } catch (error: any) {
      console.error("Chyba při načítání Garmin aktivit:", error);
    }
  };

  const generateSummary = async (type: 'sleep' | 'last_workout' | 'weekly_overview') => {
    setSummaryDialog(prev => ({ ...prev, open: true, type, loading: true, content: '' }));
    try {
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: { summaryType: type }
      });

      if (error) throw error;

      setSummaryDialog(prev => ({ ...prev, content: data.summary, loading: false }));
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Nepodařilo se vygenerovat shrnutí');
      setSummaryDialog(prev => ({ ...prev, open: false, loading: false }));
    }
  };

  const getWeatherRecommendation = async () => {
    setWeatherDialog(prev => ({ ...prev, open: true, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke('get-weather-recommendation', {
        body: { city: 'Plzeň', country: 'CZ' }
      });

      if (error) throw error;

      setWeatherDialog(prev => ({ 
        ...prev, 
        data: data.weather, 
        recommendation: data.recommendation, 
        loading: false 
      }));
    } catch (error) {
      console.error('Error getting weather:', error);
      toast.error('Nepodařilo se načíst počasí');
      setWeatherDialog(prev => ({ ...prev, open: false, loading: false }));
    }
  };

  const getSummaryTitle = () => {
    switch (summaryDialog.type) {
      case 'sleep': return 'AI Shrnutí spánku';
      case 'last_workout': return 'AI Shrnutí posledního tréninku';
      case 'weekly_overview': return 'AI Týdenní přehled';
      default: return 'AI Shrnutí';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Načítání...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Fitness Trenér</h1>
        <p className="text-muted-foreground">
          Váš osobní trenér s přístupem k datům ze Stravy a Garminu
        </p>
      </div>

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
                onClick={syncStravaActivities} 
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
        <GarminImport onImportComplete={() => {
          loadGarminActivities();
          toast.success("Aktivity importovány");
        }} />

        {/* Sleep Import */}
        <SleepImport onImportComplete={() => {
          loadGarminActivities();
          toast.success("Spánková data importována");
        }} />

        {/* BodyCombat Tracker */}
        <BodyCombatTracker />

        {/* Runalyze Backup Analyzer */}
        <RunalyzeBackupAnalyzer />

        {/* Full Import */}
        <RunalyzeFullImport onComplete={() => {
          loadGarminActivities();
          toast.success("Všechna data importována");
        }} />

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
      </div>

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

      {/* Sleep Charts */}
      <SleepCharts />

      {/* Health Data Charts */}
      <HealthDataCharts />

      {/* Weight Chart */}
      <WeightChart />

      {/* BodyCombat Stats */}
      <BodyCombatStats />

      {/* Calorie Tracker */}
      <CalorieTracker />

      {/* Race Goals Widget */}
      <RaceGoalsWidget />

      {/* Weekly Overview */}
      <WeeklyOverview />

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

      {/* Race Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Závody a cíle
          </CardTitle>
          <CardDescription>
            Plánované závody a tréninkové cíle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Přidávejte cíle a závody v konverzaci s asistentem
          </p>
        </CardContent>
      </Card>

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
