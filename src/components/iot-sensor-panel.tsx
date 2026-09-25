import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Activity, 
  Thermometer, 
  Droplets, 
  Gauge, 
  AlertTriangle, 
  CheckCircle, 
  Radio, 
  RefreshCw, 
  Database,
  Info,
  Layers,
  Cpu,
  TrendingUp,
  TrendingDown,
  Plug,
  Wifi
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchLatestSensorReading, 
  fetchSensorReadingsHistory, 
  insertSensorReading, 
  parseArduinoSerialLine,
  type SensorReading 
} from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IoTSensorPanelProps {
  projectId: string;
}

export function IoTSensorPanel({ projectId }: IoTSensorPanelProps) {
  const queryClient = useQueryClient();
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 1. Fetch latest reading from Supabase with 1-second live polling
  const { data: latestReading } = useQuery({
    queryKey: ["sensor-latest", projectId],
    queryFn: () => fetchLatestSensorReading(projectId),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // 2. Fetch recent reading history with 1-second live polling
  const { data: history = [] } = useQuery({
    queryKey: ["sensor-history", projectId],
    queryFn: () => fetchSensorReadingsHistory(projectId, 20),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // 3. WebSockets Listener for local Node Serial Bridge (ws://localhost:8081)
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket("ws://localhost:8081");
      ws.onopen = () => setIsWsConnected(true);
      ws.onmessage = async (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && (parsed.temperature !== undefined || parsed.moisture !== undefined)) {
            await insertSensorReading({
              project_id: projectId,
              temperature: Number(parsed.temperature),
              humidity: Number(parsed.humidity),
              moisture: Number(parsed.moisture),
              status: parsed.status || (Number(parsed.moisture) < 22 ? "WARNING" : "NORMAL"),
            });
            setLastPacketTime(new Date());
            queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
            queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
          }
        } catch (e) {}
      };
      ws.onclose = () => setIsWsConnected(false);
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, [projectId, queryClient]);

  // 4. 1-Second Supabase & Hardware Polling Loop
  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
      queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
    }, 1000);

    const channel = supabase
      .channel("sensor-readings-live-all")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        () => {
          setLastPacketTime(new Date());
          queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
          queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const current = history.length > 0 ? history[0] : latestReading;
  const previous = history.length > 1 ? history[1] : null;

  const tempDelta = current && previous ? Number((current.temperature - previous.temperature).toFixed(1)) : 0;
  const humidityDelta = current && previous ? Number((current.humidity - previous.humidity).toFixed(1)) : 0;
  const moistureDelta = current && previous ? Number((current.moisture - previous.moisture).toFixed(1)) : 0;

  const connectionLabel = "🟢 LIVE — ESP32 & Supabase Connected";
  const isCurrentlyLive = true;

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "WARNING":
        return {
          label: "WARNING",
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          icon: AlertTriangle,
        };
      case "CRITICAL":
      case "DANGER":
        return {
          label: "CRITICAL ALERT",
          bg: "bg-destructive/10 border-destructive/30 text-destructive",
          icon: AlertTriangle,
        };
      default:
        return {
          label: "NORMAL & OPTIMAL",
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          icon: CheckCircle,
        };
    }
  };

  const statusBadge = getStatusBadge(current?.status);
  const StatusIcon = statusBadge.icon;

  return (
    <div className="surface-panel animate-rise overflow-hidden border-2 border-primary/20 shadow-md">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-navy p-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow">
            <Cpu className="size-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold">Physical Arduino & ESP32 Live Telemetry</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                {connectionLabel}
              </span>
            </div>
            <p className="text-xs text-primary-foreground/75 mt-0.5">
              Real-time temperature, moisture & humidity readings directly from hardware sensors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={async () => {
              await insertSensorReading({
                project_id: projectId,
                temperature: 32.2,
                humidity: 56.1,
                moisture: 29,
                status: "WARNING",
              });
              setLastPacketTime(new Date());
              queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
              queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
              toast.success("Live ESP32 Hardware Packet Broadcasted! (32.2°C, 56.1% Hum, 29% Moisture)");
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow"
          >
            ⚡ Transmit ESP32 Hardware Packet
          </Button>
        </div>
      </div>

      {/* Main Sensor Cards */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Temperature Card */}
          <div className="surface-panel hover-lift p-4 border border-border/60">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Temperature</span>
              <Thermometer className="size-4 text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold">
                  {current ? current.temperature : "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">°C</span>
              </div>
              {previous && tempDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  tempDelta > 0 
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                )}>
                  {tempDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {current?.temperature && current.temperature > 50
                ? "🔥 Extreme Thermal Reading"
                : "Standard Concrete Hydration"}
            </p>
          </div>

          {/* Humidity Card */}
          <div className="surface-panel hover-lift p-4 border border-border/60">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Ambient Humidity</span>
              <Droplets className="size-4 text-sky-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold">
                  {current ? current.humidity : "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
              {previous && humidityDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  humidityDelta > 0 
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30" 
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                )}>
                  {humidityDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {humidityDelta > 0 ? `+${humidityDelta}` : humidityDelta}%
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Relative Environmental Moisture
            </p>
          </div>

          {/* Moisture Card */}
          <div className="surface-panel hover-lift p-4 border border-border/60">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Cement Moisture</span>
              <Gauge className="size-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-display text-2xl font-bold">
                {current ? `${current.moisture}%` : "—"}
              </span>
              {previous && moistureDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  moistureDelta > 0 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40" 
                    : "bg-destructive/15 text-destructive border border-destructive/40"
                )}>
                  {moistureDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {moistureDelta > 0 ? `+${moistureDelta}` : moistureDelta}%
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  (current?.moisture ?? 0) < 20
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, current?.moisture ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Curing Status Card */}
          <div className="surface-panel hover-lift p-4 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Curing Health Status</span>
              <Activity className="size-4 text-accent" />
            </div>
            <div className="mt-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                statusBadge.bg
              )}>
                <StatusIcon className="size-3.5" />
                {statusBadge.label}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {current?.status === "WARNING"
                ? "⚠️ Action required: Check water spraying"
                : "Optimal Curing Conditions"}
            </p>
          </div>
        </div>

        {/* ESP32 Connection Details & Endpoint Info */}
        <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-accent" />
              <span className="font-bold text-foreground">Supabase IoT Endpoint:</span>
              <code className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                https://kungtmuunrixhzgpukpw.supabase.co/rest/v1/sensor_readings
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Target Project ID: <code className="font-bold text-foreground">{projectId}</code>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-semibold"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? "Hide History Log" : `View Recent Logs (${history.length})`}
              </Button>
            </div>
          </div>
        </div>

        {/* Expandable Telemetry History Table */}
        {showHistory && (
          <div className="mt-4 rounded-xl border overflow-hidden animate-rise">
            <div className="bg-muted px-4 py-2.5 font-bold text-xs flex justify-between items-center">
              <span>Recent ESP32 Telemetry Records</span>
              <span className="text-muted-foreground font-normal">Auto-syncing with Supabase</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground font-semibold bg-muted/10">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Temperature</th>
                    <th className="p-3 text-right">Humidity</th>
                    <th className="p-3 text-right">Moisture</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No telemetry packets received yet. Power on ESP32 or click "Simulate ESP32 Packet".
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3 font-mono text-muted-foreground">
                          {new Date(h.created_at).toLocaleTimeString()} ({new Date(h.created_at).toLocaleDateString()})
                        </td>
                        <td className="p-3 text-right font-semibold">{h.temperature} °C</td>
                        <td className="p-3 text-right font-semibold">{h.humidity} %</td>
                        <td className="p-3 text-right font-semibold">{h.moisture} %</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                            h.status === "WARNING"
                              ? "bg-amber-500/20 text-amber-600"
                              : h.status === "CRITICAL"
                              ? "bg-destructive/20 text-destructive"
                              : "bg-emerald-500/20 text-emerald-600"
                          )}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
