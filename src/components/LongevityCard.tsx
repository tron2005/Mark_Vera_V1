import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Activity, Clock, TrendingUp, Weight, Scale, ArrowUp, ArrowDown, Minus, Lightbulb } from "lucide-react";
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
  rhrTrend: 'up' | 'down' | 'stable' | null;
  hrvTrend: 'up' | 'down' | 'stable' | null;
  recommendations: string[];
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
    rhrTrend: null,
    hrvTrend: null,
    recommendations: [],
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

      // Načíst HRV trendy (posledních 7 dní vs předchozích 7 dní)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: recentHRV } = await supabase
        .from("hrv_logs")
        .select("hrv")
        .eq("user_id", user.id)
        .gte("date", sevenDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: false });

      const { data: previousHRV } = await supabase
        .from("hrv_logs")
        .select("hrv")
        .eq("user_id", user.id)
        .gte("date", fourteenDaysAgo.toISOString().split('T')[0])
        .lt("date", sevenDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: false });

      const { data: recentRHR } = await supabase
        .from("heart_rate_rest")
        .select("heart_rate")
        .eq("user_id", user.id)
        .gte("date", sevenDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: false });

      const { data: previousRHR } = await supabase
        .from("heart_rate_rest")
        .select("heart_rate")
        .eq("user_id", user.id)
        .gte("date", fourteenDaysAgo.toISOString().split('T')[0])
        .lt("date", sevenDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: false });

      // Načíst běžecké aktivity pro VO2max odhad
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: runningActivities } = await supabase
        .from("strava_activities")
        .select("distance_meters, moving_time_seconds, average_heartrate, max_heartrate")
        .eq("user_id", user.id)
        .eq("activity_type", "Run")
        .gte("start_date", thirtyDaysAgo.toISOString())
        .order("start_date", { ascending: false })
        .limit(10);

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

      // Vypočítat trendy
      const avgRecentHRV = recentHRV && recentHRV.length > 0
        ? recentHRV.reduce((sum, r) => sum + Number(r.hrv), 0) / recentHRV.length
        : null;
      const avgPreviousHRV = previousHRV && previousHRV.length > 0
        ? previousHRV.reduce((sum, r) => sum + Number(r.hrv), 0) / previousHRV.length
        : null;

      let hrvTrend: 'up' | 'down' | 'stable' | null = null;
      if (avgRecentHRV && avgPreviousHRV) {
        const diff = avgRecentHRV - avgPreviousHRV;
        hrvTrend = Math.abs(diff) < 3 ? 'stable' : diff > 0 ? 'up' : 'down';
      }

      const avgRecentRHR = recentRHR && recentRHR.length > 0
        ? recentRHR.reduce((sum, r) => sum + Number(r.heart_rate), 0) / recentRHR.length
        : null;
      const avgPreviousRHR = previousRHR && previousRHR.length > 0
        ? previousRHR.reduce((sum, r) => sum + Number(r.heart_rate), 0) / previousRHR.length
        : null;

      let rhrTrend: 'up' | 'down' | 'stable' | null = null;
      if (avgRecentRHR && avgPreviousRHR) {
        const diff = avgRecentRHR - avgPreviousRHR;
        rhrTrend = Math.abs(diff) < 2 ? 'stable' : diff > 0 ? 'up' : 'down';
      }

      // Vypočítat VO2max z běžeckých dat (zjednodušený vzorec)
      let vo2max = null;
      if (runningActivities && runningActivities.length > 0 && chronologicalAge && gender) {
        // Průměrná rychlost v km/h z posledních běhů
        const avgSpeed = runningActivities.reduce((sum, a) => {
          const distance = a.distance_meters ? a.distance_meters / 1000 : 0;
          const time = a.moving_time_seconds ? a.moving_time_seconds / 3600 : 1;
          return sum + (distance / time);
        }, 0) / runningActivities.length;

        // Zjednodušený odhad VO2max podle rychlosti běhu a věku
        // Formula: VO2max ≈ (speed × 3.5) + age_adjustment + gender_adjustment
        const ageAdjustment = chronologicalAge > 30 ? -(chronologicalAge - 30) * 0.5 : 0;
        const genderAdjustment = gender === 'male' ? 5 : 0;
        vo2max = Math.round((avgSpeed * 3.5) + ageAdjustment + genderAdjustment);
        
        // Korekce podle tepové frekvence, pokud je k dispozici
        const avgMaxHR = runningActivities
          .filter(a => a.max_heartrate)
          .reduce((sum, a) => sum + (a.max_heartrate || 0), 0) / runningActivities.filter(a => a.max_heartrate).length;
        
        if (avgMaxHR && rhr && avgMaxHR > 0) {
          // Cooper formula variant: VO2max = 15 × (maxHR / RHR)
          const cooperEstimate = 15 * (avgMaxHR / rhr);
          vo2max = Math.round((vo2max + cooperEstimate) / 2); // Průměr obou odhadů
        }
      }

      // Zjednodušený výpočet biologického věku na základě klidové tepové frekvence, HRV a VO2max
      let biologicalAge = chronologicalAge;
      if (chronologicalAge && rhr) {
        // Lepší tepová frekvence = mladší biologický věk
        const hrFactor = rhr < 60 ? -2 : rhr > 70 ? 2 : 0;
        const hrvFactor = hrv && hrv > 50 ? -1 : hrv && hrv < 30 ? 1 : 0;
        const vo2Factor = vo2max && vo2max > 45 ? -2 : vo2max && vo2max < 35 ? 2 : 0;
        biologicalAge = chronologicalAge + hrFactor + hrvFactor + vo2Factor;
      }

      // Generovat doporučení
      const recommendations: string[] = [];
      if (rhr && rhr > 70) {
        recommendations.push("Tvá klidová tepová frekvence je vyšší. Pravidelný aerobní trénink 3-4× týdně může pomoci ji snížit.");
      }
      if (hrv && hrv < 30) {
        recommendations.push("Nízká HRV může signalizovat přetrénování nebo stres. Zvažte aktivní odpočinek a kvalitní spánek.");
      }
      if (bmi && bmi > 25) {
        recommendations.push("BMI ukazuje nadváhu. Zvažte kalorický deficit a pravidelný pohyb pro zdravější váhu.");
      }
      if (bmi && bmi < 18.5) {
        recommendations.push("BMI ukazuje podváhu. Konzultuj s lékařem nebo nutricionistou správný jídelníček.");
      }
      if (vo2max && vo2max < 35) {
        recommendations.push("VO2max je nižší. Intervalové běhy a tempo běhy mohou pomoci zlepšit aerobní kapacitu.");
      }
      if (rhrTrend === 'up') {
        recommendations.push("Klidová tepová frekvence roste. Zkontroluj, zda nedochází k přetrénování nebo nedostatku odpočinku.");
      }
      if (hrvTrend === 'down') {
        recommendations.push("HRV klesá - signál, že tělo potřebuje více regenerace. Zvažte lehčí týden nebo den volna.");
      }

      setMetrics({
        biologicalAge,
        chronologicalAge,
        vo2max,
        restingHeartRate: rhr,
        hrv: hrv ? Math.round(hrv) : null,
        bmi,
        bmr,
        currentWeight: weight,
        idealWeight,
        height,
        gender,
        rhrTrend,
        hrvTrend,
        recommendations,
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

  const getVO2MaxStatus = (vo2max: number) => {
    if (vo2max > 55) return { label: "Vynikající", color: "text-green-500", progress: 95 };
    if (vo2max > 45) return { label: "Výborná", color: "text-blue-500", progress: 80 };
    if (vo2max > 35) return { label: "Průměrná", color: "text-yellow-500", progress: 60 };
    return { label: "Nízká", color: "text-red-500", progress: 40 };
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | null) => {
    if (!trend) return null;
    if (trend === 'up') return <ArrowUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <ArrowDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
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
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">HRV (variabilita tepové frekvence)</div>
                    {getTrendIcon(metrics.hrvTrend)}
                  </div>
                  <Badge className={getHRVStatus(metrics.hrv).color}>
                    {getHRVStatus(metrics.hrv).label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{metrics.hrv} ms</div>
              </div>
            </div>
            <Progress value={getHRVStatus(metrics.hrv).progress} className="h-2" />
            {metrics.hrvTrend && (
              <div className="text-xs text-muted-foreground">
                Trend za poslední týden: {metrics.hrvTrend === 'up' ? 'roste' : metrics.hrvTrend === 'down' ? 'klesá' : 'stabilní'}
              </div>
            )}
          </div>
        )}

        {/* VO2max */}
        {metrics.vo2max && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 mt-1 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">VO2max (aerobní kapacita)</div>
                  <Badge className={getVO2MaxStatus(metrics.vo2max).color}>
                    {getVO2MaxStatus(metrics.vo2max).label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">{metrics.vo2max} ml/kg/min</div>
              </div>
            </div>
            <Progress value={getVO2MaxStatus(metrics.vo2max).progress} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Odhad na základě běžeckých aktivit za poslední měsíc
            </div>
          </div>
        )}

        {/* Doporučení */}
        {metrics.recommendations.length > 0 && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">Doporučení pro zlepšení:</div>
              <ul className="space-y-1.5 text-sm">
                {metrics.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
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
