import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Activity, Heart, Clock, MapPin, TrendingUp, Flame,
    Mountain, Gauge, Timer, Footprints, Bike, Dumbbell, Waves, ChevronRight, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityDetailDialogProps {
    activity: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const getActivityInfo = (type: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('run') || t.includes('jog')) return { label: 'Běh', color: 'text-green-500', bg: 'bg-green-500/10', icon: Activity };
    if (t.includes('walk') || t.includes('hike')) return { label: 'Chůze', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Footprints };
    if (t.includes('ride') || t.includes('cycling') || t.includes('bike')) return { label: 'Cyklistika', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Bike };
    if (t.includes('weight') || t.includes('strength') || t.includes('crossfit')) return { label: 'Posilování', color: 'text-purple-500', bg: 'bg-purple-500/10', icon: Dumbbell };
    if (t.includes('swim')) return { label: 'Plavání', color: 'text-cyan-500', bg: 'bg-cyan-500/10', icon: Waves };
    return { label: type, color: 'text-primary', bg: 'bg-primary/10', icon: Activity };
};

const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
};

const formatPace = (distanceMeters: number, timeSeconds: number) => {
    if (!distanceMeters || distanceMeters === 0) return null;
    const paceSecondsPerKm = timeSeconds / (distanceMeters / 1000);
    const paceMin = Math.floor(paceSecondsPerKm / 60);
    const paceSec = Math.round(paceSecondsPerKm % 60);
    return `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
};

export const ActivityDetailDialog = ({ activity, open, onOpenChange }: ActivityDetailDialogProps) => {
    if (!activity) return null;

    const info = getActivityInfo(activity.type);
    const IconComponent = info.icon;
    const pace = formatPace(activity.distance, activity.moving_time);
    const avgSpeedKmh = activity.distance > 0
        ? ((activity.distance / 1000) / (activity.moving_time / 3600)).toFixed(1)
        : null;

    const startDate = new Date(activity.start_date);
    const formattedDate = startDate.toLocaleDateString('cs-CZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const formattedTime = startDate.toLocaleTimeString('cs-CZ', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Stats grid data
    const stats = [
        {
            label: 'Vzdálenost',
            value: `${(activity.distance / 1000).toFixed(2)} km`,
            icon: MapPin,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            show: activity.distance > 0
        },
        {
            label: 'Doba pohybu',
            value: formatDuration(activity.moving_time),
            icon: Timer,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            show: true
        },
        {
            label: 'Tempo',
            value: pace,
            icon: Gauge,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            show: !!pace && (activity.type?.toLowerCase().includes('run') || activity.type?.toLowerCase().includes('walk'))
        },
        {
            label: 'Rychlost',
            value: avgSpeedKmh ? `${avgSpeedKmh} km/h` : null,
            icon: TrendingUp,
            color: 'text-cyan-500',
            bg: 'bg-cyan-500/10',
            show: !!avgSpeedKmh && activity.distance > 0
        },
        {
            label: 'Průměrný tep',
            value: activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : null,
            icon: Heart,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            show: !!activity.average_heartrate
        },
        {
            label: 'Maximální tep',
            value: activity.max_heartrate ? `${Math.round(activity.max_heartrate)} bpm` : null,
            icon: Heart,
            color: 'text-rose-600',
            bg: 'bg-rose-600/10',
            show: !!activity.max_heartrate
        },
        {
            label: 'Převýšení',
            value: activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain)} m` : null,
            icon: Mountain,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            show: !!activity.total_elevation_gain && activity.total_elevation_gain > 0
        },
        {
            label: 'Kalorie',
            value: activity.calories ? `${Math.round(activity.calories)} kcal` : null,
            icon: Flame,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            show: !!activity.calories && activity.calories > 0
        },
    ].filter(s => s.show && s.value);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    {/* Activity header with icon and badge */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2.5 rounded-xl ${info.bg}`}>
                            <IconComponent className={`h-6 w-6 ${info.color}`} />
                        </div>
                        <div className="flex-1">
                            <DialogTitle className="text-xl">{activity.name}</DialogTitle>
                            <div className="text-sm text-muted-foreground mt-0.5">
                                {formattedDate} · {formattedTime}
                            </div>
                        </div>
                        <Badge className={`${info.bg} ${info.color} border-0 font-semibold`}>
                            {info.label}
                        </Badge>
                    </div>
                </DialogHeader>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {stats.map((stat, idx) => {
                        const StatIcon = stat.icon;
                        return (
                            <Card key={idx} className="border-0 bg-accent/30 dark:bg-accent/10">
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className={`p-1 rounded-md ${stat.bg}`}>
                                            <StatIcon className={`h-3.5 w-3.5 ${stat.color}`} />
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                                    </div>
                                    <div className="text-lg font-bold stat-value pl-7">{stat.value}</div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* HR Zone estimation if we have HR data */}
                {activity.average_heartrate && activity.max_heartrate && (
                    <div className="mt-4 p-3 rounded-lg bg-accent/30 dark:bg-accent/10">
                        <div className="flex items-center gap-2 mb-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">Tepová zóna (odhad)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden flex">
                                <div className="bg-green-400 h-full" style={{ width: '20%' }} />
                                <div className="bg-yellow-400 h-full" style={{ width: '20%' }} />
                                <div className="bg-orange-400 h-full" style={{ width: '20%' }} />
                                <div className="bg-red-400 h-full" style={{ width: '20%' }} />
                                <div className="bg-rose-600 h-full" style={{ width: '20%' }} />
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Z1</span>
                            <span>Z2</span>
                            <span>Z3</span>
                            <span>Z4</span>
                            <span>Z5</span>
                        </div>
                        <div className="text-center text-sm mt-2 font-medium">
                            Průměr: <span className="text-red-500">{Math.round(activity.average_heartrate)} bpm</span>
                            {" → "}
                            Max: <span className="text-rose-600">{Math.round(activity.max_heartrate)} bpm</span>
                        </div>
                    </div>
                )}

                {/* Open in Strava link */}
                {activity.source === 'strava' && activity.strava_id && (
                    <div className="mt-4">
                        <Button
                            variant="outline"
                            className="w-full group"
                            onClick={() => window.open(`https://www.strava.com/activities/${activity.strava_id}`, '_blank')}
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Zobrazit ve Stravě
                            <ChevronRight className="h-4 w-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
