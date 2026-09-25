import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { 
  Check, 
  Hourglass, 
  Loader2, 
  Calendar, 
  IndianRupee, 
  CheckCircle2, 
  TrendingUp, 
  ChevronRight, 
  ArrowLeft,
  LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchProject, fetchEstimation } from "@/lib/workflow";
import { formatINR, estimateConstructionDuration } from "@/lib/estimator";
import { format, addMonths, parseISO, isValid } from "date-fns";
import { IoTSensorPanel } from "@/components/iot-sensor-panel";

export const Route = createFileRoute("/projects/$id/progress")({
  head: () => ({
    meta: [
      { title: "Construction Progress Dashboard — Smart Construction Estimator" },
      {
        name: "description",
        content: "Track month-by-month construction stage timeline, tasks, costs and overall project progress.",
      },
    ],
  }),
  component: ProgressDashboardPage,
});

// Construction stages metadata definition
const STAGES = [
  {
    name: "Foundation Work",
    progress: 20,
    tasks: [
      { label: "Site Cleaning", key: "clean" },
      { label: "JCB Excavation", key: "excavation" },
      { label: "Earthwork Backfilling", key: "earth" },
      { label: "PCC Layering", key: "pcc" },
      { label: "Footing Layout & Casting", key: "footing" },
      { label: "Basement Masonry & Plinth Beam", key: "basement" }
    ],
    costWeight: 0.15, // 15%
    items: [
      { name: "JCB & Machinery Excavation", share: 0.25 },
      { name: "Labour Charges", share: 0.15 },
      { name: "Cement & Sand", share: 0.25 },
      { name: "Steel Reinforcement (Footings)", share: 0.35 }
    ]
  },
  {
    name: "Structural Work",
    progress: 45,
    tasks: [
      { label: "Columns Framing & Casting", key: "columns" },
      { label: "Beams Layout & Reinforcement", key: "beams" },
      { label: "Ground Floor Slab Pouring", key: "slab" },
      { label: "Outer & Inner Brick Work", key: "bricks" }
    ],
    costWeight: 0.45, // 45%
    items: [
      { name: "Ready Mix Concrete (M25)", share: 0.40 },
      { name: "Structural Steel (Beams & Slabs)", share: 0.35 },
      { name: "Bricks & Mortar Sand", share: 0.15 },
      { name: "Framing & Masonry Labour", share: 0.10 }
    ]
  },
  {
    name: "Electrical & Plumbing",
    progress: 65,
    tasks: [
      { label: "Electrical Conduits Routing", key: "conduits" },
      { label: "Water & Drain Pipes Installation", key: "pipes" },
      { label: "Septic Tank Excavation & Construction", key: "septic" },
      { label: "Wall Plastering (Internal & External)", key: "plaster" }
    ],
    costWeight: 0.15, // 15%
    items: [
      { name: "PVC Pipes & Plumbing Fittings", share: 0.35 },
      { name: "Electrical Wires & Box Fitments", share: 0.35 },
      { name: "Plastering Materials (Fine Sand/Cement)", share: 0.10 },
      { name: "Skilled Labour", share: 0.20 }
    ]
  },
  {
    name: "Finishing",
    progress: 90,
    tasks: [
      { label: "Tiles Laying & Flooring Work", key: "tiles" },
      { label: "Main & Internal Doors Fitting", key: "doors" },
      { label: "Aluminium / UPVC Windows Fitting", key: "windows" },
      { label: "Painting Works (Primer & Dual Coat)", key: "paint" }
    ],
    costWeight: 0.20, // 20%
    items: [
      { name: "Ceramic / Vitrified Tiles", share: 0.45 },
      { name: "Doors, Frames & Locks", share: 0.25 },
      { name: "Wall Putty, Primer & Emulsion Paints", share: 0.20 },
      { name: "Finishing & Polish Labour", share: 0.10 }
    ]
  },
  {
    name: "Project Completion",
    progress: 100,
    tasks: [
      { label: "Interior Lighting & Switch Fittings", key: "interiors" },
      { label: "Post-Construction Deep Cleaning", key: "clean_up" },
      { label: "Final Quality Check & Project Handover", key: "handover" }
    ],
    costWeight: 0.05, // 5%
    items: [
      { name: "Sanitaryware & Electrical Switches", share: 0.50 },
      { name: "Post-construction cleaning services", share: 0.20 },
      { name: "Testing & Handover documentation", share: 0.30 }
    ]
  }
];

function distributeMonths(totalMonths: number): number[] {
  const months = [1, 1, 1, 1, 1]; // Ensure minimum 1 month per stage
  let remaining = totalMonths - 5;
  
  if (remaining > 0) {
    const sortedIndices = [1, 3, 0, 2, 4];
    while (remaining > 0) {
      for (const idx of sortedIndices) {
        if (remaining === 0) break;
        months[idx]++;
        remaining--;
      }
    }
  } else if (remaining < 0) {
    let allocated = 0;
    const initialMonths = [0, 0, 0, 0, 0];
    const priority = [1, 0, 3, 2, 4];
    for (let i = 0; i < totalMonths; i++) {
      initialMonths[priority[i % 5]]++;
    }
    return initialMonths;
  }
  return months;
}

function partitionTasks<T>(tasks: T[], k: number): T[][] {
  const result: T[][] = Array.from({ length: k }, () => []);
  if (k === 0 || tasks.length === 0) return result;
  
  const baseSize = Math.floor(tasks.length / k);
  let extra = tasks.length % k;
  
  let taskIdx = 0;
  for (let i = 0; i < k; i++) {
    const size = baseSize + (extra > 0 ? 1 : 0);
    extra--;
    for (let j = 0; j < size; j++) {
      if (taskIdx < tasks.length) {
        result[i].push(tasks[taskIdx]);
        taskIdx++;
      }
    }
  }
  return result;
}


function ProgressDashboardPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const estimation = useQuery({ queryKey: ["estimation", id], queryFn: () => fetchEstimation(id) });

  const [activeStageOverride, setActiveStageOverride] = useState<number | null>(null);

  // Map database status string to active stage index
  const stageIndex = useMemo(() => {
    if (activeStageOverride !== null) return activeStageOverride;
    const status = project.data?.status;
    switch (status) {
      case "Structural Work":
        return 1;
      case "Electrical & Plumbing":
        return 2;
      case "Finishing":
        return 3;
      case "Project Completion":
        return 4;
      case "Completed":
        return 5;
      default:
        return 0; // Foundation Work active
    }
  }, [project.data, activeStageOverride]);

  // Overall progress percentage calculations based on active stage
  const overallProgress = useMemo(() => {
    switch (stageIndex) {
      case 0: return 20; // Stage 1 Active: 20%
      case 1: return 45; // Stage 2 Active: 45%
      case 2: return 65; // Stage 3 Active: 65%
      case 3: return 90; // Stage 4 Active: 90%
      case 4: return 95; // Stage 5 Active: 95%
      case 5: return 100; // Completed: 100%
      default: return 20;
    }
  }, [stageIndex]);

  // Dynamic estimated construction duration
  const duration = useMemo(() => {
    return estimateConstructionDuration(project.data);
  }, [project.data]);

  // Distribute estimated months across 5 construction stages
  const distributed = useMemo(() => {
    return distributeMonths(duration);
  }, [duration]);

  // Project budget calculations
  const totalCost = useMemo(() => {
    return Number(project.data?.estimated_cost || estimation.data?.total_cost || project.data?.budget || 3500000);
  }, [project.data, estimation.data]);

  // Generate start date and dynamic months
  const baseDate = useMemo(() => {
    if (project.data?.start_date) {
      const parsed = parseISO(project.data.start_date);
      if (isValid(parsed)) return parsed;
    }
    if (project.data?.created_at) {
      const parsed = parseISO(project.data.created_at);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  }, [project.data]);

  const completionDateLabel = useMemo(() => {
    return format(addMonths(baseDate, duration - 1), "MMMM yyyy");
  }, [baseDate, duration]);

  const stageRanges = useMemo(() => {
    let currentStart = 1;
    return distributed.map((monthsCount) => {
      if (monthsCount <= 0) return { start: 0, end: 0 };
      const start = currentStart;
      const end = currentStart + monthsCount - 1;
      currentStart += monthsCount;
      return { start, end };
    });
  }, [distributed]);

  const timelineMonths = useMemo(() => {
    const list: {
      monthNumber: number;
      monthLabel: string;
      stageIndex: number;
      stageName: string;
      progress: number;
      tasks: { label: string; key: string }[];
      costWeight: number;
      items: { name: string; share: number }[];
    }[] = [];

    let globalMonthIndex = 0;
    
    distributed.forEach((monthsAllocated, stageIdx) => {
      if (monthsAllocated <= 0) return;
      const stage = STAGES[stageIdx];
      const stageTasks = stage.tasks;
      const partitioned = partitionTasks(stageTasks, monthsAllocated);
      
      for (let i = 0; i < monthsAllocated; i++) {
        const monthDate = addMonths(baseDate, globalMonthIndex);
        const monthLabel = format(monthDate, "MMMM yyyy");
        
        list.push({
          monthNumber: globalMonthIndex + 1,
          monthLabel,
          stageIndex: stageIdx,
          stageName: stage.name,
          progress: stage.progress,
          tasks: partitioned[i] || [],
          costWeight: stage.costWeight / monthsAllocated,
          items: stage.items.map(item => ({
            name: item.name,
            share: item.share
          }))
        });
        
        globalMonthIndex++;
      }
    });
    
    return list;
  }, [distributed, baseDate]);

  // Action status definitions
  const getNextStageStatus = (index: number) => {
    switch (index) {
      case 0: return "Structural Work";
      case 1: return "Electrical & Plumbing";
      case 2: return "Finishing";
      case 3: return "Project Completion";
      case 4: return "Completed";
      default: return "Completed";
    }
  };

  const handleMarkCompleted = async () => {
    setUpdating(true);
    try {
      const nextIdx = Math.min(5, stageIndex + 1);
      const nextStatus = getNextStageStatus(stageIndex);

      // 1. Instant local React state override (0ms rendering update!)
      setActiveStageOverride(nextIdx);

      // 2. Build updated project payload
      const baseProj = project.data || {
        id,
        user_id: "demo-user",
        project_name: "IoT Cement Monitor Project",
        owner_name: "Sujitha",
        location: "Erode, Tamil Nadu",
        building_type: "Residential",
        floors: 2,
        area: 1800,
        foundation: "Raft Foundation",
        roof: "RCC Flat Slab",
        budget: 3500000,
        start_date: new Date().toISOString().split("T")[0],
        status: nextStatus,
        estimated_cost: 3500000,
        created_at: new Date().toISOString(),
      };
      const updatedProj = { ...baseProj, status: nextStatus };

      // 3. Save locally
      saveLocalProject(updatedProj);

      // 4. Update React Query cache
      queryClient.setQueryData(["project", id], updatedProj);

      // 5. Fire-and-forget background Supabase sync
      void supabase.from("projects").upsert(updatedProj);

      toast.success(
        nextStatus === "Completed" 
          ? "🎉 Congratulations! Construction project completed!" 
          : `✅ Stage completed! "${nextStatus}" is now active.`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleStageSelect = async (newIndex: number) => {
    setUpdating(true);
    try {
      let statusText = "Foundation Work";
      if (newIndex === 1) statusText = "Structural Work";
      else if (newIndex === 2) statusText = "Electrical & Plumbing";
      else if (newIndex === 3) statusText = "Finishing";
      else if (newIndex === 4) statusText = "Project Completion";
      else if (newIndex === 5) statusText = "Completed";

      // 1. Instant local React state override (0ms rendering update!)
      setActiveStageOverride(newIndex);

      const baseProj = project.data || {
        id,
        user_id: "demo-user",
        project_name: "IoT Cement Monitor Project",
        owner_name: "Sujitha",
        location: "Erode, Tamil Nadu",
        building_type: "Residential",
        floors: 2,
        area: 1800,
        foundation: "Raft Foundation",
        roof: "RCC Flat Slab",
        budget: 3500000,
        start_date: new Date().toISOString().split("T")[0],
        status: statusText,
        estimated_cost: 3500000,
        created_at: new Date().toISOString(),
      };
      const updatedProj = { ...baseProj, status: statusText };

      // 2. Save locally
      saveLocalProject(updatedProj);

      // 3. Update React Query cache
      queryClient.setQueryData(["project", id], updatedProj);

      // 4. Fire-and-forget background Supabase sync
      void supabase.from("projects").upsert(updatedProj);

      toast.success(`Active construction stage set to: ${statusText}`);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  // Determine stage status
  const getStageStatus = (stageIdx: number, monthIndex: number) => {
    if (stageIndex > stageIdx) return { label: "Completed", color: "text-success bg-success/10 border-success/20", icon: "🟢" };
    if (stageIndex === stageIdx) return { label: "In Progress", color: "text-accent bg-accent/10 border-accent/20", icon: "🔵" };
    
    // Check if scheduled month has passed and it is not completed -> Delayed
    const scheduledMonthDate = addMonths(baseDate, monthIndex);
    const now = new Date();
    const isPast = scheduledMonthDate.getFullYear() < now.getFullYear() || 
                  (scheduledMonthDate.getFullYear() === now.getFullYear() && scheduledMonthDate.getMonth() < now.getMonth());
    
    if (isPast) return { label: "Delayed", color: "text-destructive bg-destructive/10 border-destructive/20", icon: "🔴" };
    return { label: "Pending", color: "text-muted-foreground bg-muted border-border", icon: "🟠" };
  };

  const currentMonthLabel = useMemo(() => {
    if (stageIndex >= 5) return "Completed";
    const currentMonthDate = addMonths(baseDate, stageIndex);
    return format(currentMonthDate, "MMMM yyyy");
  }, [baseDate, stageIndex]);

  const currentStageName = useMemo(() => {
    if (stageIndex >= 5) return "Completed";
    return STAGES[stageIndex].name;
  }, [stageIndex]);

  const ready = !project.isLoading && !estimation.isLoading;

  return (
    <AppShell title={project.data?.project_name ?? "Progress Tracking"} subtitle="Step 7 — Month-wise Construction Timeline">
      <div className="mx-auto max-w-5xl">
        <StepIndicator current={7} />

        {!ready ? (
          <div className="surface-panel flex items-center justify-center gap-3 p-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Loading progress dashboard…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="surface-panel hover-lift animate-rise p-4 flex flex-col justify-between" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <span>Overall Progress</span>
                  <TrendingUp className="size-4 text-accent" />
                </div>
                <div className="mt-2">
                  <p className="font-display text-2xl font-bold">{overallProgress}%</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-accent transition-all duration-500" 
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="surface-panel hover-lift animate-rise p-4 flex flex-col justify-between" style={{ animationDelay: "50ms" }}>
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Current Month</span>
                <p className="mt-2 font-display text-lg font-bold truncate">{currentMonthLabel}</p>
              </div>

              <div className="surface-panel hover-lift animate-rise p-4 flex flex-col justify-between" style={{ animationDelay: "100ms" }}>
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Active Stage</span>
                <p className="mt-2 font-display text-lg font-bold text-accent truncate">{currentStageName}</p>
              </div>

              <div className="surface-panel hover-lift animate-rise p-4 flex flex-col justify-between" style={{ animationDelay: "150ms" }}>
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <span>Estimated Cost</span>
                  <IndianRupee className="size-3.5 text-success" />
                </div>
                <p className="mt-2 font-display text-lg font-bold text-success">{formatINR(totalCost)}</p>
              </div>

              <div className="surface-panel hover-lift animate-rise p-4 flex flex-col justify-between" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <span>Completion Date</span>
                  <Calendar className="size-4 text-warning" />
                </div>
                <p className="mt-2 font-display text-lg font-bold text-warning truncate">{completionDateLabel}</p>
              </div>
            </div>

            {/* Live ESP32 IoT Sensor Telemetry Monitor */}
            <IoTSensorPanel projectId={id} />

            {/* Active Control Section */}
            <div className="surface-panel p-6 animate-rise">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <LayoutDashboard className="size-5 text-accent" /> Control Construction Stage
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Mark the current stage as completed to transition the timeline, or override to any month below.
              </p>

              <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center gap-5 justify-between bg-muted/30 p-4 rounded-xl border">
                <div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Active Stage</span>
                  <h3 className="text-2xl font-bold flex items-center gap-2 mt-1">
                    {stageIndex >= 5 ? (
                      <span className="text-success flex items-center gap-1.5">
                        <CheckCircle2 className="size-6" /> Construction Completed!
                      </span>
                    ) : (
                      <span>{STAGES[stageIndex].name}</span>
                    )}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {stageIndex < 5 && (
                    <Button 
                      onClick={handleMarkCompleted} 
                      disabled={updating}
                      className="flex-1 md:flex-initial"
                    >
                      {updating ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Mark Stage as Completed
                    </Button>
                  )}

                  <div className="flex items-center gap-2 flex-1 md:flex-initial">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Jump to:</span>
                    <select
                      value={stageIndex}
                      onChange={(e) => handleStageSelect(Number(e.target.value))}
                      disabled={updating}
                      className="flex-1 md:w-44 text-sm bg-background border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {STAGES.map((s, idx) => {
                        const range = stageRanges[idx];
                        const rangeStr = range.start === 0 
                          ? "N/A" 
                          : range.start === range.end 
                            ? `Month ${range.start}` 
                            : `Months ${range.start}-${range.end}`;
                        return (
                          <option key={idx} value={idx}>
                            {s.name} ({rangeStr})
                          </option>
                        );
                      })}
                      <option value={5}>Project Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Overall Progress Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span>Overall Construction Progress</span>
                  <span className="text-accent">{overallProgress}%</span>
                </div>
                <div className="h-4 w-full bg-muted rounded-full overflow-hidden border p-0.5">
                  <div 
                    className="h-full rounded-full bg-gradient-accent transition-all duration-700 ease-out relative" 
                    style={{ width: `${overallProgress}%` }}
                  >
                    {overallProgress > 5 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-accent-foreground font-bold">
                        {overallProgress}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Month-wise timeline */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 px-1">
                <Calendar className="size-5 text-accent" /> Construction Timeline & Estimates
              </h2>
              
              <div className="relative border-l-2 border-border/80 ml-4 pl-6 space-y-6">
                {timelineMonths.map((m, idx) => {
                  const status = getStageStatus(m.stageIndex, idx);
                  const isActive = stageIndex === m.stageIndex;
                  const isCompleted = stageIndex > m.stageIndex;
                  
                  // Cost calculations based on weight distribution
                  const stageCost = totalCost * m.costWeight;

                  return (
                    <div key={`${m.monthNumber}-${m.stageName}`} className="relative">
                      {/* Bullet marker node on vertical line */}
                      <div 
                        className={`absolute -left-[35px] top-1.5 flex size-6 items-center justify-center rounded-full border transition-all duration-300 ${
                          isCompleted 
                            ? "bg-success border-transparent text-success-foreground" 
                            : isActive 
                              ? "bg-gradient-accent border-transparent text-accent-foreground shadow-md scale-110" 
                              : status.label === "Delayed"
                                ? "bg-destructive border-transparent text-destructive-foreground animate-pulse"
                                : "bg-muted border-border text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="size-3.5" />
                        ) : (
                          <span className="text-[10px] font-bold">{m.monthNumber}</span>
                        )}
                      </div>

                      {/* Timeline Month Card */}
                      <div 
                        className={`surface-panel hover-lift animate-rise overflow-hidden ${
                          isActive ? "ring-2 ring-accent/30 border-accent/40" : ""
                        }`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 bg-muted/20">
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold">Month {m.monthNumber}</p>
                            <h3 className="font-display font-bold text-base flex items-center gap-2">
                              <span>{m.monthLabel}</span>
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                              <span className="text-accent">{m.stageName}</span>
                            </h3>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground">Progress: {m.progress}%</span>
                            <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border ${status.color}`}>
                              {status.icon} {status.label}
                            </span>
                          </div>
                        </div>

                        {/* Card Content Grid */}
                        <div className="grid gap-6 p-5 md:grid-cols-2">
                          {/* Tasks Checklist */}
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 flex items-center gap-1">
                              📋 Scheduled Tasks
                            </h4>
                            <ul className="space-y-2">
                              {m.tasks.map((task) => {
                                // Dynamically calculate task status based on whether the parent stage is completed, in progress, or pending
                                const isTaskCompleted = isCompleted;
                                const isTaskInProgress = isActive && task.key === m.tasks.find(t => t.key)?.key; // Simplified indicator
                                
                                return (
                                  <li 
                                    key={task.label} 
                                    className={`flex items-center gap-2.5 text-sm py-1 border-b border-border/40 last:border-0 ${
                                      isTaskCompleted 
                                        ? "text-foreground line-through opacity-85" 
                                        : isTaskInProgress
                                          ? "text-accent font-medium"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {isTaskCompleted ? (
                                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                                        <Check className="size-3" />
                                      </div>
                                    ) : isTaskInProgress ? (
                                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent animate-pulse">
                                        <Loader2 className="size-3 animate-spin" />
                                      </div>
                                    ) : (
                                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted border text-muted-foreground">
                                        <Hourglass className="size-2.5" />
                                      </div>
                                    )}
                                    <span>{task.label}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          {/* Estimated Monthly Cost */}
                          <div className="flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 flex items-center gap-1">
                                💰 Estimated Monthly Cost
                              </h4>
                              <div className="space-y-2">
                                {m.items.map((item) => (
                                  <div key={item.name} className="flex justify-between items-center text-sm py-1 border-b border-border/40 last:border-0">
                                    <span className="text-muted-foreground">{item.name}</span>
                                    <span className="font-semibold text-foreground">{formatINR(stageCost * item.share)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-4 pt-3.5 border-t flex items-center justify-between bg-muted/40 p-3 rounded-lg border">
                              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Estimated Cost Total</span>
                              <span className="font-display font-bold text-lg text-success">{formatINR(stageCost)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to="/projects/$id/cost" params={{ id }}>
              <ArrowLeft className="mr-2 size-4" /> Back to Cost Breakdown
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="mr-2 size-4" /> View Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link to="/projects/$id/iot" params={{ id }}>
                Continue to Step 8: Live IoT Monitor →
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
export default ProgressDashboardPage;
