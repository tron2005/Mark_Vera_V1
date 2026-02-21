import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, PlugZap, Hourglass, BookOpen, Target } from "lucide-react";

import { MotivationalQuote } from "./MotivationalQuote";
import { TrainerPerformance } from "./trainer/TrainerPerformance";
import { TrainerConnectors } from "./trainer/TrainerConnectors";
import { TrainerNutrition } from "./trainer/TrainerNutrition";
import { TrainerLongevity } from "./trainer/TrainerLongevity";
import { TrainerLibrary } from "./trainer/TrainerLibrary";
import { TrainerPlans } from "./trainer/TrainerPlans";

export const FitnessTrainer = () => {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [garminConnected, setGarminConnected] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Dialog States
  const [summaryDialog, setSummaryDialog] = useState<{ open: boolean; type: string; content: string; loading: boolean }>({
    open: false, type: '', content: '', loading: false
  });
  const [weatherDialog, setWeatherDialog] = useState<{ open: boolean; data: any; recommendation: string; loading: boolean }>({
    open: false, data: null, recommendation: '', loading: false
  });

  useEffect(() => {
    checkConnections();
  }, []);

  // Auto-sync: respect user-configured interval from Settings
  useEffect(() => {
    if (!stravaConnected || syncing || loading) return;

    const intervalHours = parseInt(localStorage.getItem('strava-sync-interval-hours') || '24', 10);
    if (intervalHours === 0) return; // Manual only

    const shouldAutoSync = () => {
      if (!lastSync) return true; // Never synced
      const threshold = new Date(Date.now() - intervalHours * 60 * 60 * 1000);
      return lastSync < threshold;
    };

    if (shouldAutoSync()) {
      console.log(`[AutoSync] Strava sync triggered (interval: ${intervalHours}h, last sync: ${lastSync?.toISOString() || "never"})`);
      syncStravaActivities(true);
    }
  }, [stravaConnected, lastSync, loading]);

  const checkConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch profile and latest body composition in parallel
    const [profileResult, bodyCompResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("strava_refresh_token, strava_access_token, garmin_refresh_token, weight_kg, age, height_cm, bmi, bmr")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("body_composition")
        .select("weight_kg")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const profile = profileResult.data;
    const latestWeight = bodyCompResult.data?.weight_kg;

    if (profile) {
      setStravaConnected(!!(profile.strava_refresh_token || profile.strava_access_token));
      setGarminConnected(!!profile.garmin_refresh_token);

      // Use latest body_composition weight if available, otherwise fallback to profile
      const updatedProfile = {
        ...profile,
        weight_kg: latestWeight ?? profile.weight_kg
      };
      setUserProfile(updatedProfile);

      if (profile.strava_refresh_token || profile.strava_access_token) {
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

    // Pokusíme se načíst z strava_sync_log
    const { data: syncLog, error: syncError } = await supabase
      .from("strava_sync_log")
      .select("last_sync_at")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("[loadLastSyncTime] strava_sync_log:", syncLog, "Error:", syncError);

    if (syncLog?.last_sync_at) {
      setLastSync(new Date(syncLog.last_sync_at));
      console.log("[loadLastSyncTime] Set lastSync from sync_log:", new Date(syncLog.last_sync_at));
      return;
    }

    // Fallback: pokud sync_log není k dispozici, použij updated_at z nejnovější aktivity
    const { data: latestActivity } = await supabase
      .from("strava_activities")
      .select("updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestActivity?.updated_at) {
      setLastSync(new Date(latestActivity.updated_at));
      console.log("[loadLastSyncTime] Set lastSync from latest activity:", new Date(latestActivity.updated_at));
    } else {
      console.log("[loadLastSyncTime] No sync data found anywhere");
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
        strava_id: activity.strava_activity_id,
        name: activity.name,
        type: activity.activity_type,
        start_date: activity.start_date,
        distance: activity.distance_meters,
        moving_time: activity.moving_time_seconds,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: activity.calories,
        total_elevation_gain: activity.total_elevation_gain,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
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

  const syncStravaActivities = async (silent = false) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-strava-activities', {
        body: { per_page: 100 }
      });

      if (error) {
        if (error.message?.includes('rate limit') || error.message?.includes('Rate Limit')) {
          if (!silent) toast.error("Strava API rate limit překročen. Zkuste to prosím za 15 minut.");
          return;
        }
        throw error;
      }

      if (data?.rateLimitExceeded) {
        if (!silent) toast.error(data.error || "Strava API rate limit překročen. Zkuste to prosím za 15 minut.");
        return;
      }

      if (data?.synced) {
        if (!silent) toast.success(`Synchronizováno ${data.activities?.length || 0} aktivit ze Stravy`);

        // Nastavit lastSync přímo z odpovědi (rychlejší než dotaz do DB)
        if (data.lastSyncAt) {
          setLastSync(new Date(data.lastSyncAt));
        }

        await loadStravaActivitiesFromDB();
      }
    } catch (error: any) {
      console.error("Chyba při synchronizaci aktivit:", error);
      if (!silent) toast.error("Nepodařilo se synchronizovat aktivity ze Stravy");
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

      const garminActivities = (data || []).map((activity: any) => ({
        id: activity.id,
        name: `Garmin ${activity.activity_type}`,
        type: activity.activity_type,
        start_date: activity.start_date,
        distance: activity.distance_km * 1000,
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

  if (loading) {
    return <div className="flex items-center justify-center h-full">Načítání...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Fitness Trenér</h1>
        <p className="text-muted-foreground mb-4">
          Váš osobní asistent pro výkon a zdraví
        </p>
        <MotivationalQuote />
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-[1080px] mb-6">
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Výkon
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            Výživa
          </TabsTrigger>
          <TabsTrigger value="longevity" className="flex items-center gap-2">
            <Hourglass className="h-4 w-4" />
            Longevity
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knihovna
          </TabsTrigger>
          <TabsTrigger value="connectors" className="flex items-center gap-2">
            <PlugZap className="h-4 w-4" />
            Konektory
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Plány
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <TrainerPerformance
            userProfile={userProfile}
            stravaConnected={stravaConnected}
            activities={activities}
            showStats={showStats}
            setShowStats={setShowStats}
            summaryDialog={summaryDialog}
            setSummaryDialog={setSummaryDialog}
            generateSummary={generateSummary}
            weatherDialog={weatherDialog}
            setWeatherDialog={setWeatherDialog}
            getWeatherRecommendation={getWeatherRecommendation}
          />
        </TabsContent>

        <TabsContent value="nutrition" className="space-y-6">
          <TrainerNutrition />
        </TabsContent>

        <TabsContent value="longevity" className="space-y-6">
          <TrainerLongevity />
        </TabsContent>

        <TabsContent value="library" className="space-y-6">
          <TrainerLibrary />
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <TrainerPlans />
        </TabsContent>

        <TabsContent value="connectors" className="space-y-6">
          <TrainerConnectors
            stravaConnected={stravaConnected}
            lastSync={lastSync}
            syncing={syncing}
            onSyncStrava={syncStravaActivities}
            onRefreshData={checkConnections}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
