import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

interface RaceGoal {
  id: string;
  race_name: string;
  race_type: string;
  race_date: string;
  target_time: string | null;
  completed: boolean;
}

export const RaceGoalsWidget = () => {
  const [upcomingRaces, setUpcomingRaces] = useState<RaceGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcomingRaces();

    // Set up realtime subscription for race goals updates
    const channel = supabase
      .channel('race_goals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'race_goals'
        },
        (payload) => {
          console.log('Race goals updated:', payload);
          loadUpcomingRaces();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUpcomingRaces = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("race_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .gte("race_date", new Date().toISOString())
        .order("race_date", { ascending: true })
        .limit(3);

      if (error) throw error;
      setUpcomingRaces(data || []);
    } catch (error) {
      console.error("Error loading race goals:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Závody a cíle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Načítám...</p>
        </CardContent>
      </Card>
    );
  }

  if (upcomingRaces.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Závody a cíle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Zatím nemáte naplánované žádné závody.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Závody a cíle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingRaces.map((race) => {
          const raceDate = new Date(race.race_date);
          const countdown = formatDistanceToNow(raceDate, { addSuffix: true, locale: cs });
          const daysUntil = Math.ceil((raceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          return (
            <div key={race.id} className="border-l-4 border-primary pl-4 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{race.race_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {race.race_type}
                    </Badge>
                    {race.target_time && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {race.target_time}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{daysUntil}</div>
                  <div className="text-xs text-muted-foreground">dní</div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {countdown}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
