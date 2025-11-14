import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Heart, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FitnessStats } from "./FitnessStats";

export const FitnessTrainer = () => {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [garminConnected, setGarminConnected] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("strava_refresh_token, garmin_refresh_token, weight_kg, age, height_cm, bmi")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setStravaConnected(!!profile.strava_refresh_token);
      setGarminConnected(!!profile.garmin_refresh_token);
      setUserProfile(profile);
      
      if (profile.strava_refresh_token) {
        loadStravaActivities();
      }
    }
    setLoading(false);
  };

  const loadStravaActivities = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-strava-activities', {
        body: { per_page: 30 }
      });

      if (error) throw error;
      setActivities(data?.activities || []);
    } catch (error: any) {
      console.error("Chyba při načítání aktivit:", error);
      toast.error("Nepodařilo se načíst aktivity ze Stravy");
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
            <div className="flex items-center justify-between">
              <span className="font-medium">Garmin</span>
              {garminConnected ? (
                <Badge variant="default" className="bg-green-600">Připojeno</Badge>
              ) : (
                <Badge variant="secondary">Nepřipojeno (v přípravě)</Badge>
              )}
            </div>
            {!stravaConnected && (
              <p className="text-sm text-muted-foreground mt-2">
                Připojte své fitness účty v Nastavení pro zobrazení dat a doporučení.
              </p>
            )}
          </CardContent>
        </Card>

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
    </div>
  );
};
