import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Activity, Clock, TrendingUp, Weight, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LongevityMetrics {
  biologicalAge: number | null;
  chronologicalAge: number | null;
  vo2max: number | null;
  restingHeartRate: number | null;
  hrv: number | null;
  bmi: number | null;
  bmr: number | null;
  currentWeight: number | null;
  idealWeight: number | null;
  height: number | null;
  gender: string | null;
}

export const LongevityCard = () => {
  const [metrics, setMetrics] = useState<LongevityMetrics>({
    biologicalAge: null,
    chronologicalAge: null,
    vo2max: null,
    restingHeartRate: null,
    hrv: null,
    bmi: null,
    bmr: null,
    currentWeight: null,
    idealWeight: null,
    height: null,
    gender: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLongevityMetrics();
  }, []);

  const loadLongevityMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Načíst profil s věkem, váhou, výškou, pohlavím
      const { data: profile } = await supabase
        .from("profiles")
        .select("age, weight_kg, height_cm, gender, bmr")
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
      const weight = profile?.weight_kg || null;
      const height = profile?.height_cm || null;
      const gender = profile?.gender || null;

      // Vypočítat BMI
      let bmi = null;
      if (weight && height) {
        const heightInMeters = height / 100;
        bmi = Number((weight / (heightInMeters * heightInMeters)).toFixed(1));
      }

      // Vypočítat BMR (Basal Metabolic Rate) - Mifflin-St Jeor equation
      let bmr = profile?.bmr || null;
      if (!bmr && weight && height && chronologicalAge && gender) {
        if (gender === 'male') {
          bmr = Math.round(10 * weight + 6.25 * height - 5 * chronologicalAge + 5);
        } else {
          bmr = Math.round(10 * weight + 6.25 * height - 5 * chronologicalAge - 161);
        }
      }

      // Ideální váha podle výšky a věku
      let idealWeight = null;
      if (height && chronologicalAge) {
        const heightInMeters = height / 100;
        // Pro věk 18-40: BMI 22, pro 40+: BMI 23-24
        const targetBMI = chronologicalAge < 40 ? 22 : 23.5;
        idealWeight = Number((targetBMI * heightInMeters * heightInMeters).toFixed(1));
      }

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
        vo2max: null,
        restingHeartRate: rhr,
        hrv: hrv ? Math.round(hrv) : null,
        bmi,
        bmr,
        currentWeight: weight,
        idealWeight,
        height,
        gender,
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

  const getBMIStatus = (bmi: number) => {
    if (bmi < 18.5) return { label: "Podváha", color: "text-yellow-500" };
    if (bmi < 25) return { label: "Normální", color: "text-green-500" };
    if (bmi < 30) return { label: "Nadváha", color: "text-orange-500" };
    return { label: "Obezita", color: "text-red-500" };
  };

  const getHRStatus = (hr: number) => {
    if (hr < 60) return { label: "Výborná", color: "text-green-500", progress: 90 };
    if (hr < 70) return { label: "Dobrá", color: "text-blue-500", progress: 70 };
    if (hr < 80) return { label: "Průměrná", color: "text-yellow-500", progress: 50 };
    return { label: "Zhoršená", color: "text-red-500", progress: 30 };
  };

  const getHRVStatus = (hrv: number) => {
    if (hrv > 70) return { label: "Výborná", color: "text-green-500", progress: 95 };
    if (hrv > 50) return { label: "Dobrá", color: "text-blue-500", progress: 75 };
    if (hrv > 30) return { label: "Průměrná", color: "text-yellow-500", progress: 55 };
    return { label: "Slabá", color: "text-red-500", progress: 35 };
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

        {/* BMI a váha */}
        {metrics.bmi && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-start gap-3">
              <Scale className="h-5 w-5 mt-1 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">BMI (Body Mass Index)</div>
                  <Badge className={getBMIStatus(metrics.bmi).color}>
                    {getBMIStatus(metrics.bmi).label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{metrics.bmi}</div>
              </div>
            </div>
            {metrics.currentWeight && metrics.idealWeight && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Aktuální váha</span>
                  <span className="font-medium">{metrics.currentWeight} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ideální váha</span>
                  <span className="font-medium">{metrics.idealWeight} kg</span>
                </div>
                {Math.abs(metrics.currentWeight - metrics.idealWeight) > 2 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {metrics.currentWeight > metrics.idealWeight 
                      ? `↓ ${(metrics.currentWeight - metrics.idealWeight).toFixed(1)} kg k ideální váze`
                      : `↑ ${(metrics.idealWeight - metrics.currentWeight).toFixed(1)} kg k ideální váze`
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BMR */}
        {metrics.bmr && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Weight className="h-5 w-5 mt-1 text-primary" />
            <div className="flex-1">
              <div className="text-sm font-medium">BMR (základní metabolismus)</div>
              <div className="text-2xl font-bold mt-1">{metrics.bmr} kcal/den</div>
              <div className="text-xs text-muted-foreground mt-1">
                Energie v klidu
              </div>
            </div>
          </div>
        )}

        {/* Klidová tepová frekvence */}
        {metrics.restingHeartRate && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 mt-1 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Klidová tepová frekvence</div>
                  <Badge className={getHRStatus(metrics.restingHeartRate).color}>
                    {getHRStatus(metrics.restingHeartRate).label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{metrics.restingHeartRate} bpm</div>
              </div>
            </div>
            <Progress value={getHRStatus(metrics.restingHeartRate).progress} className="h-2" />
          </div>
        )}

        {/* HRV */}
        {metrics.hrv && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 mt-1 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">HRV (variabilita tepové frekvence)</div>
                  <Badge className={getHRVStatus(metrics.hrv).color}>
                    {getHRVStatus(metrics.hrv).label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{metrics.hrv} ms</div>
              </div>
            </div>
            <Progress value={getHRVStatus(metrics.hrv).progress} className="h-2" />
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
