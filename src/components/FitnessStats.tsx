import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MapPin, Clock, Gauge as GaugeIcon, Flame, Heart } from "lucide-react";

interface Activity {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  start_date: string;
  average_speed: number;
  max_speed: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  kilojoules?: number;
}

interface FitnessStatsProps {
  activities: Activity[];
}

export const FitnessStats = ({ activities }: FitnessStatsProps) => {
  if (!activities || activities.length === 0) {
    return null;
  }

  // Příprava dat pro grafy - agregace podle dní
  const activityByDate = activities.reduce((acc: any, activity) => {
    const date = new Date(activity.start_date).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit'
    });

    if (!acc[date]) {
      acc[date] = {
        date,
        distance: 0,
        time: 0,
        count: 0,
        elevation: 0
      };
    }

    acc[date].distance += activity.distance / 1000;
    acc[date].time += activity.moving_time / 60;
    acc[date].count += 1;
    acc[date].elevation += activity.total_elevation_gain || 0;

    return acc;
  }, {});

  const chartData = Object.values(activityByDate)
    .slice(-10)
    .map((item: any) => ({
      ...item,
      distance: parseFloat(item.distance.toFixed(2)),
      time: Math.round(item.time),
      elevation: Math.round(item.elevation)
    }));

  // Data podle typu aktivity
  const activityByType = activities.reduce((acc: any, activity) => {
    const type = activity.type;
    if (!acc[type]) {
      acc[type] = {
        type,
        count: 0,
        totalDistance: 0,
        totalTime: 0,
      };
    }
    acc[type].count += 1;
    acc[type].totalDistance += activity.distance / 1000;
    acc[type].totalTime += activity.moving_time / 60;
    return acc;
  }, {});

  const typeChartData = Object.values(activityByType).map((item: any) => ({
    type: item.type,
    count: item.count,
    distance: parseFloat(item.totalDistance.toFixed(2)),
    time: Math.round(item.totalTime),
  }));

  // Pásma tepové frekvence (zóny)
  const activitiesWithHR = activities.filter(act => act.average_heartrate);
  const hrZones = {
    'Zóna 1 (50-60%)': 0,
    'Zóna 2 (60-70%)': 0,
    'Zóna 3 (70-80%)': 0,
    'Zóna 4 (80-90%)': 0,
    'Zóna 5 (90-100%)': 0,
  };

  activitiesWithHR.forEach(act => {
    const maxHR = 220 - 30; // Předpokládaný věk 30, později lze doplnit z profilu
    const avgHR = act.average_heartrate || 0;
    const percentage = (avgHR / maxHR) * 100;

    if (percentage < 60) hrZones['Zóna 1 (50-60%)']++;
    else if (percentage < 70) hrZones['Zóna 2 (60-70%)']++;
    else if (percentage < 80) hrZones['Zóna 3 (70-80%)']++;
    else if (percentage < 90) hrZones['Zóna 4 (80-90%)']++;
    else hrZones['Zóna 5 (90-100%)']++;
  });

  const hrZoneData = Object.entries(hrZones).map(([zone, count]) => ({
    zone,
    count,
  }));

  // Celkové statistiky
  const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0) / 1000;
  const totalTime = activities.reduce((sum, act) => sum + act.moving_time, 0) / 60;
  const avgDistance = totalDistance / activities.length;
  const avgSpeed = activities.reduce((sum, act) => sum + act.average_speed, 0) / activities.length;

  const avgHeartrate = activitiesWithHR.length > 0
    ? activitiesWithHR.reduce((sum, act) => sum + (act.average_heartrate || 0), 0) / activitiesWithHR.length
    : 0;

  const totalCalories = activities.reduce((sum, act) => sum + (act.calories || 0), 0);

  return (
    <div className="space-y-6">
      {/* Celkové statistiky */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="card-hover animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-500" />
              Celková vzdálenost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-value">{totalDistance.toFixed(1)} km</div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fade-in animate-fade-in-delay-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-purple-500" />
              Celkový čas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-value">{Math.round(totalTime)} min</div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fade-in animate-fade-in-delay-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <GaugeIcon className="h-3.5 w-3.5 text-green-500" />
              Průměrná rychlost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-value">{(avgSpeed * 3.6).toFixed(1)} km/h</div>
          </CardContent>
        </Card>

        <Card className="card-hover animate-fade-in animate-fade-in-delay-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Celkové kalorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold stat-value">{Math.round(totalCalories)} kcal</div>
          </CardContent>
        </Card>

        {avgHeartrate > 0 && (
          <Card className="card-hover animate-fade-in animate-fade-in-delay-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-red-500" />
                Průměrný tep
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold stat-value">{Math.round(avgHeartrate)} bpm</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Graf vzdálenosti */}
      <Card className="card-hover animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-blue-500" />
            Vzdálenost (posledních 10 dní)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="distance"
                stroke="#3b82f6"
                name="Vzdálenost (km)"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graf času a převýšení */}
      <Card className="card-hover animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-purple-500" />
            Čas a převýšení (posledních 10 dní)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="time"
                fill="#8b5cf6"
                name="Čas (min)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="elevation"
                fill="#06b6d4"
                name="Převýšení (m)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graf podle typu aktivity */}
      <Card className="card-hover animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-500" />
            Aktivity podle typu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={typeChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="distance"
                fill="#3b82f6"
                name="Vzdálenost (km)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="count"
                fill="#f59e0b"
                name="Počet aktivit"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pásma tepové frekvence */}
      {activitiesWithHR.length > 0 && (
        <Card className="card-hover animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-red-500" />
              Tréninkové zóny (podle tepové frekvence)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hrZoneData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="zone" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="count"
                  fill="#ef4444"
                  name="Počet tréninků"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-4">
              Tepové zóny pomáhají optimalizovat trénink. Nižší zóny (1-2) pro vytrvalost, vyšší (4-5) pro intenzitu a rychlost.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};