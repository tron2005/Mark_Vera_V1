import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celková vzdálenost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDistance.toFixed(1)} km</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkový čas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalTime)} min</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Průměrná rychlost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgSpeed * 3.6).toFixed(1)} km/h</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkové kalorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalCalories)} kcal</div>
          </CardContent>
        </Card>
        
        {avgHeartrate > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Průměrný tep
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(avgHeartrate)} bpm</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Graf vzdálenosti */}
      <Card>
        <CardHeader>
          <CardTitle>Vzdálenost (posledních 10 dní)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="distance" 
                stroke="hsl(var(--primary))" 
                name="Vzdálenost (km)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graf času a převýšení */}
      <Card>
        <CardHeader>
          <CardTitle>Čas a převýšení (posledních 10 dní)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar 
                yAxisId="left" 
                dataKey="time" 
                fill="hsl(var(--primary))" 
                name="Čas (min)"
              />
              <Bar 
                yAxisId="right" 
                dataKey="elevation" 
                fill="hsl(var(--secondary))" 
                name="Převýšení (m)"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graf podle typu aktivity */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivity podle typu</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar 
                yAxisId="left" 
                dataKey="distance" 
                fill="hsl(var(--primary))" 
                name="Vzdálenost (km)"
              />
              <Bar 
                yAxisId="right" 
                dataKey="count" 
                fill="hsl(var(--accent))" 
                name="Počet aktivit"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pásma tepové frekvence */}
      {activitiesWithHR.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tréninkové zóny (podle tepové frekvence)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hrZoneData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="zone" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--destructive))" 
                  name="Počet tréninků"
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