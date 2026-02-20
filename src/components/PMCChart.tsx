import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
import { DailyMetric } from "@/utils/fitnessMetrics";

interface PMCChartProps {
    history: DailyMetric[];
}

type ChartView = 'pmc' | 'trimp';

export const PMCChart = ({ history }: PMCChartProps) => {
    const [view, setView] = useState<ChartView>('pmc');

    const chartData = useMemo(() => {
        return history.map(day => ({
            date: day.date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
            CTL: day.ctl,
            ATL: day.atl,
            TSB: day.tsb,
            TRIMP: day.trimp,
        }));
    }, [history]);

    if (history.length === 0) return null;

    return (
        <Card className="col-span-full card-hover animate-fade-in">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {view === 'pmc' ? 'Performance Management Chart (PMC)' : 'Denní tréninková zátěž (TRIMP)'}
                    </CardTitle>
                    <div className="flex gap-1">
                        <Button
                            variant={view === 'pmc' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setView('pmc')}
                        >
                            <Activity className="h-3 w-3 mr-1" />
                            PMC
                        </Button>
                        <Button
                            variant={view === 'trimp' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setView('trimp')}
                        >
                            <BarChart3 className="h-3 w-3 mr-1" />
                            TRIMP
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {view === 'pmc' ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="gradCTL" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradATL" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                            <Area
                                type="monotone"
                                dataKey="CTL"
                                stroke="#3b82f6"
                                fill="url(#gradCTL)"
                                strokeWidth={2}
                                name="Kondice (CTL)"
                                dot={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="ATL"
                                stroke="#f97316"
                                fill="url(#gradATL)"
                                strokeWidth={2}
                                name="Únava (ATL)"
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="TSB"
                                stroke="#22c55e"
                                strokeWidth={2}
                                name="Forma (TSB)"
                                dot={false}
                                strokeDasharray="5 5"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar
                                dataKey="TRIMP"
                                fill="#8b5cf6"
                                name="TRIMP (Tréninková zátěž)"
                                radius={[3, 3, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {view === 'pmc' ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                                <span>CTL = dlouhodobá kondice (42 dní)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-orange-500 rounded" />
                                <span>ATL = krátkodobá únava (7 dní)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-0.5 bg-green-500 rounded border-dashed" />
                                <span>TSB = forma (CTL − ATL)</span>
                            </div>
                        </>
                    ) : (
                        <span>TRIMP (Training Impulse) je míra zátěže tréninku založená na tepové frekvenci a době trvání.</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
