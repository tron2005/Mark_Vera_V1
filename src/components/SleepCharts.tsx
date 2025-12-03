import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SelectWithLabel } from "@/components/ui/select-with-label";

// Define colors for different sources
const SOURCE_COLORS: Record<string, string> = {
  'RingConn': 'hsl(280, 70%, 50%)', // Purple for RingConn
  'Garmin': 'hsl(var(--chart-1))',
  'default': 'hsl(var(--primary))'
};

interface SleepData {
  sleep_date: string;
  duration_minutes: number | null;
  deep_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  rem_duration_minutes: number | null;
  awake_duration_minutes: number | null;
  quality: number | null;
  hr_lowest: number | null;
  hr_average: number | null;
  source: string | null;
}

interface ChartDataPoint {
  date: string;
  source?: string;
  celkem: number;
  hluboky: number;
  lehky: number;
  rem: number;
  bdely: number;
  kvalita: number;
  tep: number;
  [key: string]: number | string | undefined;
}

export const SleepCharts = () => {
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | 'all'>('all');
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  useEffect(() => {
    loadSleepData();
  }, []);

  const loadSleepData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("sleep_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      setSleepData(data || []);
      
      // Get unique sources
      const sources = [...new Set((data || []).map(d => d.source).filter(Boolean))];
      setAvailableSources(sources as string[]);
    } catch (error) {
      console.error("Chyba při načítání spánkových dat:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceColor = (source: string) => {
    return SOURCE_COLORS[source] || SOURCE_COLORS['default'];
  };

  if (loading) {
    return <div>Načítání...</div>;
  }

  if (sleepData.length === 0) {
    return null;
  }

  // Filter data by selected source
  const filteredData = selectedSource === 'all' 
    ? sleepData 
    : sleepData.filter(d => d.source === selectedSource);

  // Prepare data for charts (reverse to show oldest first)
  const chartData: ChartDataPoint[] = [...filteredData].reverse().map(sleep => {
    const base: ChartDataPoint = {
      date: new Date(sleep.sleep_date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
      source: sleep.source || undefined,
      celkem: sleep.duration_minutes ? Math.round(sleep.duration_minutes / 60 * 10) / 10 : 0,
      hluboky: sleep.deep_sleep_minutes ? Math.round(sleep.deep_sleep_minutes / 60 * 10) / 10 : 0,
      lehky: sleep.light_sleep_minutes ? Math.round(sleep.light_sleep_minutes / 60 * 10) / 10 : 0,
      rem: sleep.rem_duration_minutes ? Math.round(sleep.rem_duration_minutes / 60 * 10) / 10 : 0,
      bdely: sleep.awake_duration_minutes ? Math.round(sleep.awake_duration_minutes / 60 * 10) / 10 : 0,
      kvalita: sleep.quality || 0,
      tep: sleep.hr_lowest || 0,
    };
    // Add source-specific keys for multi-source display
    if (sleep.source) {
      base[`celkem_${sleep.source}`] = base.celkem;
      base[`kvalita_${sleep.source}`] = base.kvalita;
      base[`tep_${sleep.source}`] = base.tep;
    }
    return base;
  });

  // Create merged data for multi-source charts
  const mergedChartData = selectedSource === 'all' && availableSources.length > 1
    ? [...sleepData].reverse().reduce((acc: ChartDataPoint[], sleep) => {
        const dateStr = new Date(sleep.sleep_date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        let existing = acc.find(d => d.date === dateStr);
        if (!existing) {
          existing = {
            date: dateStr,
            celkem: 0,
            hluboky: 0,
            lehky: 0,
            rem: 0,
            bdely: 0,
            kvalita: 0,
            tep: 0
          };
          acc.push(existing);
        }
        if (sleep.source) {
          existing[`celkem_${sleep.source}`] = sleep.duration_minutes ? Math.round(sleep.duration_minutes / 60 * 10) / 10 : 0;
          existing[`kvalita_${sleep.source}`] = sleep.quality || 0;
          existing[`tep_${sleep.source}`] = sleep.hr_lowest || 0;
        }
        return acc;
      }, [])
    : chartData;

  const sourceOptions = [
    { value: 'all', label: 'Všechny zdroje' },
    ...availableSources.map(source => ({ value: source, label: source }))
  ];

  const showMultiSource = selectedSource === 'all' && availableSources.length > 1;

  return (
    <div className="space-y-6">
      {availableSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filtr zdrojů dat</CardTitle>
          </CardHeader>
          <CardContent>
            <SelectWithLabel
              label="Zdroj dat"
              value={selectedSource}
              onValueChange={setSelectedSource}
              options={sourceOptions}
              placeholder="Vyberte zdroj"
            />
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Délka spánku
          </CardTitle>
          <CardDescription>Celková délka spánku za poslední měsíc (hodiny)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={showMultiSource ? mergedChartData : chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              {showMultiSource ? (
                availableSources.map(source => (
                  <Bar 
                    key={source}
                    dataKey={`celkem_${source}`}
                    fill={getSourceColor(source)}
                    name={`${source} (h)`}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              ) : (
                <Bar 
                  dataKey="celkem" 
                  fill={selectedSource !== 'all' ? getSourceColor(selectedSource) : "hsl(var(--primary))"} 
                  name="Celkem (h)" 
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fáze spánku</CardTitle>
          <CardDescription>Rozložení spánkových fází (hodiny)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar dataKey="hluboky" stackId="a" fill="hsl(var(--chart-1))" name="Hluboký" />
              <Bar dataKey="rem" stackId="a" fill="hsl(var(--chart-2))" name="REM" />
              <Bar dataKey="lehky" stackId="a" fill="hsl(var(--chart-3))" name="Lehký" />
              <Bar dataKey="bdely" stackId="a" fill="hsl(var(--chart-4))" name="Bdělý" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kvalita spánku a klidový tep</CardTitle>
          <CardDescription>Hodnocení kvality a nejnižší tepová frekvence</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={showMultiSource ? mergedChartData : chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              {showMultiSource ? (
                availableSources.flatMap(source => [
                  <Line 
                    key={`kvalita_${source}`}
                    yAxisId="left"
                    type="monotone" 
                    dataKey={`kvalita_${source}`}
                    stroke={getSourceColor(source)}
                    name={`Kvalita ${source}`}
                    strokeWidth={3}
                    dot={{ fill: getSourceColor(source), r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />,
                  <Line 
                    key={`tep_${source}`}
                    yAxisId="right"
                    type="monotone" 
                    dataKey={`tep_${source}`}
                    stroke={getSourceColor(source)}
                    strokeDasharray="5 5"
                    name={`Tep ${source}`}
                    strokeWidth={2}
                    dot={{ fill: getSourceColor(source), r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ])
              ) : (
                <>
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="kvalita" 
                    stroke={selectedSource !== 'all' ? getSourceColor(selectedSource) : "hsl(var(--chart-1))"}
                    name="Kvalita (0-100)"
                    strokeWidth={3}
                    dot={{ fill: selectedSource !== 'all' ? getSourceColor(selectedSource) : "hsl(var(--chart-1))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="tep" 
                    stroke={selectedSource !== 'all' ? getSourceColor(selectedSource) : "hsl(var(--chart-2))"}
                    name="Nejnižší tep (bpm)"
                    strokeWidth={3}
                    dot={{ fill: selectedSource !== 'all' ? getSourceColor(selectedSource) : "hsl(var(--chart-2))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
