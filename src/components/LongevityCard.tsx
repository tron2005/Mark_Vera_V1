import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Activity, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LongevityMetrics {
  biologicalAge: number | null;
  chronologicalAge: number | null;
  vo2max: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
}

export const LongevityCard = () => {
  const [metrics, setMetrics] = useState<LongevityMetrics>({
    biologicalAge: null,
    chronologicalAge: null,
    vo2max: null,
    restingHeartRate: null,
    hrv: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLongevityMetrics();
  }, []);

  const loadLongevityMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Načíst věk z profilu
      const { data: profile } = await supabase
        .from("profiles")
        .select("age")
        .eq("user_id", user.id)
        .maybeSingle();

      // Načíst poslední klidovou tepovou frekvenci
      const { data: restingHR } = await supabase
        .from("heart_rate_rest")
        .select("heart_rate")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Načíst poslední HRV
      const { data: hrvData } = await supabase
        .from("hrv_logs")
        .select("hrv")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const chronologicalAge = profile?.age || null;
      const rhr = restingHR?.heart_rate || null;
      const hrv = hrvData?.hrv || null;

      // Zjednodušený výpočet biologického věku na základě klidové tepové frekvence a HRV
      let biologicalAge = chronologicalAge;
      if (chronologicalAge && rhr) {
        // Lepší tepová frekvence = mladší biologický věk
        const hrFactor = rhr < 60 ? -2 : rhr > 70 ? 2 : 0;
        const hrvFactor = hrv && hrv > 50 ? -1 : hrv && hrv < 30 ? 1 : 0;
        biologicalAge = chronologicalAge + hrFactor + hrvFactor;
      }

      setMetrics({
        biologicalAge,
        chronologicalAge,
        vo2max: null, // TODO: Vypočítat z aktivit
        restingHeartRate: rhr,
        hrv: hrv ? Math.round(hrv) : null,
      });
    } catch (error) {
      console.error("Error loading longevity metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Longevity
          </CardTitle>
          <CardDescription>Metriky dlouhověkosti a biologický věk</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Načítám...</p>
        </CardContent>
      </Card>
    );
  }

  const getAgeDifference = () => {
    if (!metrics.biologicalAge || !metrics.chronologicalAge) return null;
    const diff = metrics.biologicalAge - metrics.chronologicalAge;
    if (diff < 0) {
      return (
        <Badge variant="default" className="bg-green-500">
          {Math.abs(diff)} let mladší
        </Badge>
      );
    } else if (diff > 0) {
      return (
        <Badge variant="destructive">
          {diff} let starší
        </Badge>
      );
    }
    return <Badge variant="secondary">Odpovídá věku</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Longevity
        </CardTitle>
        <CardDescription>Metriky dlouhověkosti a biologický věk</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Biologický vs chronologický věk */}
        <div className="border-l-4 border-primary pl-4 py-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Biologický věk</h4>
            {getAgeDifference()}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <div className="text-xs text-muted-foreground">Biologický</div>
              <div className="text-2xl font-bold text-primary">
                {metrics.biologicalAge || "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Skutečný</div>
              <div className="text-2xl font-bold">
                {metrics.chronologicalAge || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Klidová tepová frekvence */}
        {metrics.restingHeartRate && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Activity className="h-5 w-5 mt-1 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">Klidová tepová frekvence</div>
              <div className="text-2xl font-bold mt-1">{metrics.restingHeartRate} bpm</div>
            </div>
          </div>
        )}

        {/* HRV */}
        {metrics.hrv && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <TrendingUp className="h-5 w-5 mt-1 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">HRV (variabilita tepové frekvence)</div>
              <div className="text-2xl font-bold mt-1">{metrics.hrv} ms</div>
            </div>
          </div>
        )}

        {/* Placeholder pro další metriky */}
        {!metrics.restingHeartRate && !metrics.hrv && (
          <div className="text-center py-4">
            <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Začni sledovat data pro výpočet biologického věku
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
