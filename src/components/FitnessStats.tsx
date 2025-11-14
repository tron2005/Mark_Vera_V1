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

  // Celkové statistiky
  const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0) / 1000;
  const totalTime = activities.reduce((sum, act) => sum + act.moving_time, 0) / 60;
  const avgDistance = totalDistance / activities.length;
  const avgSpeed = activities.reduce((sum, act) => sum + act.average_speed, 0) / activities.length;
  
  const activitiesWithHR = activities.filter(act => act.average_heartrate);
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
    </div>
  );
};