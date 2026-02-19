import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Heart, Activity, Weight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SelectWithLabel } from "@/components/ui/select-with-label";

// Define colors for different sources
const SOURCE_COLORS: Record<string, string> = {
  'RingConn': 'hsl(280, 70%, 50%)', // Purple for RingConn
  'Garmin': 'hsl(var(--chart-1))',
  'default': 'hsl(var(--chart-2))'
};

interface ChartData {
  date: string;
  restingHR?: number;
  restingHRSource?: string;
  hrv?: number;
  hrvSource?: string;
  weight?: number;
  // Multi-source data
  [key: string]: number | string | undefined;
}

export const HealthDataCharts = () => {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHRSource, setSelectedHRSource] = useState<string | 'all'>('all');
  const [selectedHRVSource, setSelectedHRVSource] = useState<string | 'all'>('all');
  const [hrSources, setHRSources] = useState<string[]>([]);
  const [hrvSources, setHRVSources] = useState<string[]>([]);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [hrData, hrvData, weightData] = await Promise.all([
        supabase
          .from("heart_rate_rest")
          .select("date, heart_rate, source")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true }),
        supabase
          .from("hrv_logs")
          .select("date, hrv, source")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true }),
        supabase
          .from("body_composition")
          .select("date, weight_kg")
          .eq("user_id", user.id)
          .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
          .order("date", { ascending: true })
      ]);

      // Get unique sources
      const uniqueHRSources = [...new Set(hrData.data?.map(d => d.source).filter(Boolean))];
      const uniqueHRVSources = [...new Set(hrvData.data?.map(d => d.source).filter(Boolean))];
      setHRSources(uniqueHRSources as string[]);
      setHRVSources(uniqueHRVSources as string[]);

      // Merge data by date with source-specific keys
      const dateMap = new Map<string, ChartData>();

      hrData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        entry.restingHR = item.heart_rate;
        entry.restingHRSource = item.source || undefined;
        // Add source-specific key for multi-source display
        const sourceKey = `hr_${item.source || 'unknown'}`;
        entry[sourceKey] = item.heart_rate;
      });

      hrvData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        entry.hrv = Math.round(item.hrv);
        entry.hrvSource = item.source || undefined;
        // Add source-specific key for multi-source display
        const sourceKey = `hrv_${item.source || 'unknown'}`;
        entry[sourceKey] = Math.round(item.hrv);
      });

      weightData.data?.forEach(item => {
        const date = new Date(item.date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
        if (!dateMap.has(date)) dateMap.set(date, { date });
        dateMap.get(date)!.weight = Number(item.weight_kg);
      });

      setData(Array.from(dateMap.values()));
    } catch (error) {
      console.error("Chyba při načítání zdravotních dat:", error);
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

  if (data.length === 0) {
    return null;
  }

  // Filter data by selected sources
  const filteredHRData = data.map(d => ({
    ...d,
    restingHR: (selectedHRSource === 'all' || d.restingHRSource === selectedHRSource) ? d.restingHR : undefined
  }));

  const filteredHRVData = data.map(d => ({
    ...d,
    hrv: (selectedHRVSource === 'all' || d.hrvSource === selectedHRVSource) ? d.hrv : undefined
  }));

  const hasHRData = filteredHRData.some(d => d.restingHR);
  const hasHRVData = filteredHRVData.some(d => d.hrv);
  const hasWeightData = data.some(d => d.weight);

  const hrSourceOptions = [
    { value: 'all', label: 'Všechny zdroje' },
    ...hrSources.map(source => ({ value: source, label: source }))
  ];

  const hrvSourceOptions = [
    { value: 'all', label: 'Všechny zdroje' },
    ...hrvSources.map(source => ({ value: source, label: source }))
  ];

  return (
    <div className="space-y-6">
      {(hrSources.length > 1 || hrvSources.length > 1) && (
        <Card>
          <CardHeader>
            <CardTitle>Filtr zdrojů dat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hrSources.length > 1 && (
              <SelectWithLabel
                label="Zdroj klidového tepu"
                value={selectedHRSource}
                onValueChange={setSelectedHRSource}
                options={hrSourceOptions}
                placeholder="Vyberte zdroj"
              />
            )}
            {hrvSources.length > 1 && (
              <SelectWithLabel
                label="Zdroj HRV"
                value={selectedHRVSource}
                onValueChange={setSelectedHRVSource}
                options={hrvSourceOptions}
                placeholder="Vyberte zdroj"
              />
            )}
          </CardContent>
        </Card>
      )}
      
      {hasHRData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Klidový tep
            </CardTitle>
            <CardDescription>Vývoj klidové tepové frekvence za posledních 30 dní</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {selectedHRSource === 'all' && hrSources.length > 1 ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  {hrSources.map(source => (
                    <Line 
                      key={source}
                      type="monotone" 
                      dataKey={`hr_${source}`}
                      stroke={getSourceColor(source)}
                      strokeWidth={2}
                      dot={{ fill: getSourceColor(source), r: 3 }}
                      name={`${source} (bpm)`}
                      connectNulls
                    />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={filteredHRData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="restingHR" 
                    stroke={selectedHRSource !== 'all' ? getSourceColor(selectedHRSource) : "hsl(var(--chart-1))"}
                    fill={selectedHRSource !== 'all' ? getSourceColor(selectedHRSource) : "hsl(var(--chart-1))"}
                    fillOpacity={0.3}
                    name="Klidový tep (bpm)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasHRVData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              HRV (variabilita srdeční frekvence)
            </CardTitle>
            <CardDescription>Ukazatel regenerace a celkového stavu organismu</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={selectedHRVSource === 'all' && hrvSources.length > 1 ? data : filteredHRVData}>
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
                {selectedHRVSource === 'all' && hrvSources.length > 1 ? (
                  hrvSources.map(source => (
                    <Line 
                      key={source}
                      type="monotone" 
                      dataKey={`hrv_${source}`}
                      stroke={getSourceColor(source)}
                      strokeWidth={2}
                      dot={{ fill: getSourceColor(source), r: 3 }}
                      name={`${source} (ms)`}
                      connectNulls
                    />
                  ))
                ) : (
                  <Line 
                    type="monotone" 
                    dataKey="hrv" 
                    stroke={selectedHRVSource !== 'all' ? getSourceColor(selectedHRVSource) : "hsl(var(--chart-2))"}
                    strokeWidth={2}
                    dot={{ fill: selectedHRVSource !== 'all' ? getSourceColor(selectedHRVSource) : "hsl(var(--chart-2))", r: 3 }}
                    name="HRV (ms)"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasWeightData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Weight className="h-5 w-5" />
              Váha
            </CardTitle>
            <CardDescription>Vývoj tělesné hmotnosti</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-3))", r: 3 }}
                  name="Váha (kg)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
