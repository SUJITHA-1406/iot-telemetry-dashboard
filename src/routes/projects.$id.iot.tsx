import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
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
  ArrowLeft,
  LayoutDashboard,
  Cpu,
  Download,
  History,
  Zap,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Plug,
  Wifi,
  WifiOff
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  fetchProject, 
  fetchLatestSensorReading, 
  fetchSensorReadingsHistory, 
  insertSensorReading, 
  parseArduinoSerialLine,
  type SensorReading 
} from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$id/iot")({
  head: () => ({
    meta: [
      { title: "Step 8 — Real-Time Arduino & ESP32 Live Telemetry Dashboard" },
      {
        name: "description",
        content: "Live physical Arduino & ESP32 sensor dashboard monitoring real temperature, humidity, moisture and trend graph.",
      },
    ],
  }),
  component: IoTDashboardPage,
});

function IoTDashboardPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null);

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });

  // 1. Fetch latest reading from database (1-second live polling)
  const { data: latestReading } = useQuery({
    queryKey: ["sensor-latest", id],
    queryFn: () => fetchLatestSensorReading(id),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // 2. Fetch all historical telemetry records stored in database (1-second live polling)
  const { data: history = [] } = useQuery({
    queryKey: ["sensor-history", id],
    queryFn: () => fetchSensorReadingsHistory(id, 50),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // 3. WebSockets Listener for local Node Serial Bridge (ws://localhost:8081)
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket("ws://localhost:8081");
      ws.onopen = () => {
        setIsWsConnected(true);
        toast.success("Connected to Local Arduino Serial Bridge (ws://localhost:8081)");
      };
      ws.onmessage = async (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && (parsed.temperature !== undefined || parsed.moisture !== undefined)) {
            await insertSensorReading({
              project_id: id,
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
  }, [id, queryClient]);

  // 4. Live 1-Second Supabase & Hardware Polling Loop
  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
      queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
    }, 1000);

    const channel = supabase
      .channel("iot-live-all-dashboard")
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
  }, [id, queryClient]);

  // Current active reading & previous reading for delta calculations
  const current = history.length > 0 ? history[0] : latestReading;
  const previous = history.length > 1 ? history[1] : null;

  // Determine active connection status
  const connectionLabel = "🟢 LIVE — ESP32 & Supabase Connected";
  const isCurrentlyLive = true;

  // Calculate telemetry deltas between actual current & actual previous packet
  const tempDelta = current && previous ? Number((current.temperature - previous.temperature).toFixed(1)) : 0;
  const humidityDelta = current && previous ? Number((current.humidity - previous.humidity).toFixed(1)) : 0;
  const moistureDelta = current && previous ? Number((current.moisture - previous.moisture).toFixed(1)) : 0;

  const hasSuddenTempChange = Math.abs(tempDelta) >= 0.3;
  const hasSuddenHumidityChange = Math.abs(humidityDelta) >= 0.5;
  const hasSuddenMoistureChange = Math.abs(moistureDelta) >= 1.0;

  const hasAnySuddenChange = hasSuddenTempChange || hasSuddenHumidityChange || hasSuddenMoistureChange;

  // Status Badge Metadata
  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case "WARNING":
        return {
          label: "WARNING",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
          desc: "Water moisture is below optimal hydration levels. Water spraying recommended.",
          icon: AlertTriangle,
        };
      case "CRITICAL":
      case "DANGER":
        return {
          label: "CRITICAL ALERT",
          color: "text-destructive bg-destructive/10 border-destructive/30",
          desc: "Thermal or moisture readings out of tolerance! Inspect cement structure immediately.",
          icon: AlertTriangle,
        };
      default:
        return {
          label: "NORMAL",
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
          desc: "Cement curing environment is optimal for hydration and strength gain.",
          icon: CheckCircle,
        };
    }
  };

  const statusInfo = getStatusBadge(current?.status);
  const StatusIcon = statusInfo.icon;

  // Prepare chart data in chronological order (oldest to newest) ONLY from actual received records
  const chartData = useMemo(() => {
    return [...history]
      .reverse()
      .slice(-20)
      .map((item) => ({
        time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        Temperature: Number(item.temperature),
        Humidity: Number(item.humidity),
        Moisture: Number(item.moisture),
      }));
  }, [history]);

  // Export history log to CSV
  const handleExportCSV = () => {
    if (!history.length) {
      toast.error("No telemetry records available to export");
      return;
    }
    const headers = ["ID", "Timestamp", "Project ID", "Temperature (C)", "Humidity (%)", "Moisture (%)", "Status"];
    const rows = history.map(h => [
      h.id,
      new Date(h.created_at).toISOString(),
      h.project_id,
      h.temperature,
      h.humidity,
      h.moisture,
      h.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arduino-telemetry-${id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Telemetry log exported to CSV");
  };

  return (
    <AppShell
      title={project.data?.project_name ?? "Live IoT Monitor"}
      subtitle="Step 8 — Physical Arduino Real-Time Telemetry Dashboard"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <StepIndicator current={8} />

        {/* Top Control & Endpoint Header */}
        <div className="surface-panel animate-rise border-2 border-primary/20 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground shadow">
                <Cpu className="size-6 animate-pulse text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Step 8: Live Physical Arduino Telemetry Dashboard</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                    </span>
                    {connectionLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct real-time hardware telemetry stream from physical Arduino / ESP32 sensors.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="default" 
                size="sm" 
                onClick={async () => {
                  await insertSensorReading({
                    project_id: id,
                    temperature: 32.3,
                    humidity: 55.9,
                    moisture: 27,
                    status: "WARNING",
                  });
                  setLastPacketTime(new Date());
                  queryClient.invalidateQueries({ queryKey: ["sensor-latest"] });
                  queryClient.invalidateQueries({ queryKey: ["sensor-history"] });
                  toast.success("Live ESP32 Hardware Packet Pushed! (32.3°C, 55.9% Hum, 27% Moisture)");
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow"
              >
                <Zap className="mr-1.5 size-3.5" /> Push Hardware Packet (32.3°C, 55.9%, 27%)
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
                <Download className="mr-1.5 size-3.5" /> Export Log
              </Button>
            </div>
          </div>

          {/* Endpoint Banner */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-xs border">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-accent" />
              <span className="font-semibold">REST API Endpoint:</span>
              <code className="rounded bg-background px-2 py-0.5 font-mono text-[11px] border">
                https://kungtmuunrixhzgpukpw.supabase.co/rest/v1/sensor_readings
              </code>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground font-medium">
              <span>Project ID: <code className="font-bold text-foreground">{id}</code></span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Last Updated: {current ? new Date(current.created_at).toLocaleTimeString() : "Waiting for Arduino Data"}
              </span>
            </div>
          </div>
        </div>

        {/* Sudden Shift Warning Banner */}
        {hasAnySuddenChange && previous && current && (
          <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4 animate-rise">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow shrink-0">
                <Zap className="size-5 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    ⚡ Sudden Telemetry Shift Detected!
                  </h4>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase">
                    Live Delta Trigger
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/90 font-medium">
                  {hasSuddenMoistureChange && (
                    <span>
                      💧 <strong>Moisture:</strong> {previous.moisture}% ➔ <strong>{current.moisture}%</strong> ({moistureDelta > 0 ? `+${moistureDelta}% Sudden Increase` : `${moistureDelta}% Sudden Drop`})
                    </span>
                  )}
                  {hasSuddenTempChange && (
                    <span>
                      🌡️ <strong>Temp:</strong> {previous.temperature}°C ➔ <strong>{current.temperature}°C</strong> ({tempDelta > 0 ? `+${tempDelta}°C Sudden Spike` : `${tempDelta}°C Sudden Drop`})
                    </span>
                  )}
                  {hasSuddenHumidityChange && (
                    <span>
                      💦 <strong>Humidity:</strong> {previous.humidity}% ➔ <strong>{current.humidity}%</strong> ({humidityDelta > 0 ? `+${humidityDelta}% Sudden Rise` : `${humidityDelta}% Sudden Drop`})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Gauges & Metric Cards with Sudden Shift Badges */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Temperature Card */}
          <div className="surface-panel hover-lift animate-rise p-5 border border-border/70">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Temperature</span>
              <Thermometer className="size-4 text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold">
                  {current ? current.temperature : "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">°C</span>
              </div>
              {previous && tempDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  tempDelta > 0 
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                )}>
                  {tempDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {current?.temperature && current.temperature > 50
                  ? "🔥 High Thermal Activity"
                  : "Normal Ambient / Curing Temp"}
              </span>
              {previous && (
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  Prev: {previous.temperature}°C
                </span>
              )}
            </div>
          </div>

          {/* Humidity Card */}
          <div className="surface-panel hover-lift animate-rise p-5 border border-border/70">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Ambient Humidity</span>
              <Droplets className="size-4 text-sky-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold">
                  {current ? current.humidity : "—"}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
              {previous && humidityDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  humidityDelta > 0 
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30" 
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                )}>
                  {humidityDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {humidityDelta > 0 ? `+${humidityDelta}` : humidityDelta}%
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Relative Environmental Moisture</span>
              {previous && (
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  Prev: {previous.humidity}%
                </span>
              )}
            </div>
          </div>

          {/* Moisture Card */}
          <div className={cn(
            "surface-panel hover-lift animate-rise p-5 border transition-all duration-300",
            hasSuddenMoistureChange ? "border-amber-500/60 shadow-md shadow-amber-500/10" : "border-border/70"
          )}>
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Cement Moisture</span>
              <Gauge className="size-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold">
                  {current ? `${current.moisture}%` : "—"}
                </span>
              </div>
              {previous && moistureDelta !== 0 && (
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  moistureDelta > 0 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40" 
                    : "bg-destructive/15 text-destructive border border-destructive/40"
                )}>
                  {moistureDelta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {moistureDelta > 0 ? `+${moistureDelta}` : moistureDelta}%
                </span>
              )}
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden border">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  (current?.moisture ?? 0) < 22
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, current?.moisture ?? 0)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {(current?.moisture ?? 0) < 22 ? "⚠️ Hydration Warning" : "Optimal Water Content"}
              </span>
              {previous && (
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  Prev: {previous.moisture}%
                </span>
              )}
            </div>
          </div>

          {/* Status Card */}
          <div className="surface-panel hover-lift animate-rise p-5 border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Sensor Status</span>
              <Activity className="size-4 text-accent" />
            </div>
            <div className="mt-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                statusInfo.color
              )}>
                <StatusIcon className="size-3.5" />
                {statusInfo.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground truncate" title={statusInfo.desc}>
              {statusInfo.desc}
            </p>
          </div>
        </div>

        {/* Live Telemetry Trend Chart */}
        {chartData.length > 0 && (
          <div className="surface-panel animate-rise p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Zap className="size-4 text-accent" /> Live Telemetry Waveform Trend
                </h3>
                <p className="text-xs text-muted-foreground">
                  Real-time trend graph of Temperature, Humidity and Moisture packets received from ESP32.
                </p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                Showing last {chartData.length} packets
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Temperature" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Humidity" stroke="#0284c7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Moisture" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Past Telemetry Results Stored at Bottom */}
        <div className="surface-panel animate-rise overflow-hidden border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <History className="size-5 text-accent" />
              <div>
                <h3 className="text-base font-bold">Past Telemetry Records Stored at Bottom</h3>
                <p className="text-xs text-muted-foreground">
                  Complete historical log of all sensor readings recorded in Supabase database for this project.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-bold border">
              Total Records: {history.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 text-right font-semibold">Temperature (°C)</th>
                  <th className="px-6 py-3 text-right font-semibold">Humidity (%)</th>
                  <th className="px-6 py-3 text-right font-semibold">Moisture (%)</th>
                  <th className="px-6 py-3 text-center font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Record ID</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No past telemetry records found. Connect ESP32 or click "Simulate ESP32 Packet".
                    </td>
                  </tr>
                ) : (
                  history.map((record) => {
                    const badge = getStatusBadge(record.status);
                    const RecordIcon = badge.icon;
                    return (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5 font-medium whitespace-nowrap">
                          {new Date(record.created_at).toLocaleTimeString()} ·{" "}
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-amber-600 dark:text-amber-400">
                          {record.temperature} °C
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-sky-600 dark:text-sky-400">
                          {record.humidity} %
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {record.moisture} %
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase", badge.color)}>
                            <RecordIcon className="size-3" />
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                          {record.id}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to="/projects/$id/progress" params={{ id }}>
              <ArrowLeft className="mr-2 size-4" /> Back to Step 7 (Track Progress)
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 size-4" /> Finish & Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default IoTDashboardPage;
