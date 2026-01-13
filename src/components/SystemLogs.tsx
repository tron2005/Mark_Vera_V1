import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LogLevel = 'info' | 'warning' | 'error';

interface Log {
  id: string;
  created_at: string;
  level: LogLevel;
  source: string;
  message: string;
  details: any;
  metadata: any;
}

export function SystemLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
    } catch (error: any) {
      console.error('Error loading logs:', error);
      toast({
        title: "Chyba při načítání logů",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    // Auto-refresh každých 10 sekund
    const interval = setInterval(loadLogs, 10000);

    // Realtime subscription
    const channel = supabase
      .channel('logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
        },
        () => {
          loadLogs();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [levelFilter]);

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    const variants: Record<LogLevel, "default" | "destructive" | "secondary"> = {
      error: "destructive",
      warning: "secondary",
      info: "default",
    };
    return <Badge variant={variants[level]}>{level.toUpperCase()}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Právě teď';
    if (diffMins === 1) return 'Před 1 minutou';
    if (diffMins < 60) return `Před ${diffMins} minutami`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Před 1 hodinou';
    if (diffHours < 24) return `Před ${diffHours} hodinami`;

    return date.toLocaleString('cs-CZ');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Systémové logy</CardTitle>
            <CardDescription>
              Poslední události pro debugging a monitoring
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] w-full pr-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Info className="h-8 w-8 mb-2" />
              <p>Žádné logy k zobrazení</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getLevelBadge(log.level)}
                      <Badge variant="outline">{log.source}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{log.message}</p>
                    {log.details && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          Detaily
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
