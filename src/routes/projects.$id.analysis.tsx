import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Cpu, Loader2, ScanLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fetchProject, getOrCreateDetections, saveDetections } from "@/lib/workflow";
import { overallConfidence, type Detections } from "@/lib/estimator";

export const Route = createFileRoute("/projects/$id/analysis")({
  head: () => ({
    meta: [
      { title: "AI Blueprint Analysis — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "AI detection of walls, doors, windows, columns, beams, sockets, HVAC and fire safety lines from uploaded blueprints with confidence scores.",
      },
      { property: "og:title", content: "AI Blueprint Analysis" },
      {
        property: "og:description",
        content: "Component detection results and confidence scores for every uploaded drawing.",
      },
    ],
  }),
  component: AnalysisPage,
});

import { cn } from "@/lib/utils";

import { getActiveModel, getStoredModels, setActiveModel } from "@/lib/ai-training";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BrainCircuit } from "lucide-react";

function AnalysisPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [activeModel, setActiveModelObj] = useState(() => getActiveModel());

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const detections = useQuery({
    queryKey: ["detections", id],
    enabled: !!project.data,
    queryFn: async () => {
      const d = await getOrCreateDetections(project.data!);
      await saveDetections(project.data!, d, overallConfidence(d));
      return d;
    },
  });

  useEffect(() => {
    if (!scanning) return;
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(t);
          setScanning(false);
          return 100;
        }
        return p + 4;
      });
    }, 45);
    return () => clearInterval(t);
  }, [scanning]);

  const d = detections.data;
  const ready = !scanning && !!d;

  const displayDetections = d
    ? selectedFloor === "all"
      ? d
      : d.floors?.find((fl) => fl.floor === selectedFloor) ?? d
    : null;

  const displayConfidence = displayDetections
    ? selectedFloor === "all"
      ? overallConfidence(d)
      : Number(
        (
          (displayDetections.confidence.civil +
            displayDetections.confidence.electrical +
            displayDetections.confidence.mechanical) /
          3
        ).toFixed(1)
      )
    : "—";

  const getScanningMessage = () => {
    if (ready) return `Detection model output ready from ${activeModel.name}.`;
    const floors = project.data?.floors ?? 1;
    if (floors > 1) {
      if (progress < 20) return `[${activeModel.architecture.toUpperCase()}] Reading combined multi-floor blueprint...`;
      if (progress < 40) return `[${activeModel.name}] Identifying pages & mapping CAD layouts...`;
      if (progress < 60) return "Analyzing Ground Floor blueprints (Civil/Elec/Mech)...";
      if (progress < 85) return "Analyzing Upper Floor blueprints (Civil/Elec/Mech)...";
      return "Combining floor-wise detections & calculating project aggregates...";
    }
    return `Preprocessing drawings with ${activeModel.name} and detecting symbols.`;
  };

  return (
    <AppShell
      title={project.data?.project_name ?? "AI Analysis"}
      subtitle="Step 3 — AI Blueprint Component Detection"
      actions={
        <Link
          to="/datasets"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <BrainCircuit className="size-3.5 text-primary" />
          <span>Model: <strong className="text-primary">{activeModel.name}</strong></span>
          <Badge variant="secondary" className="text-[9px] font-mono">
            {activeModel.metrics.mAP50}% mAP
          </Badge>
        </Link>
      }
    >
      <StepIndicator current={3} />

      {/* Model info banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span>
            Inference powered by active model: <strong className="text-foreground">{activeModel.name}</strong> ({activeModel.architecture})
          </span>
        </div>
        <Link
          to="/datasets"
          className="text-primary font-semibold hover:underline flex items-center gap-1"
        >
          Train new dataset or switch model →
        </Link>
      </div>

      <div className="surface-panel animate-rise mb-6 flex flex-wrap items-center gap-5 p-6">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
          {ready ? <Cpu className="size-6" /> : <ScanLine className="size-6 animate-pulse" />}
        </div>
        <div className="min-w-52 flex-1">
          <p className="text-sm font-bold">
            {ready ? "Analysis complete" : "Analysing blueprints…"}
          </p>
          <p className="text-xs text-muted-foreground">{getScanningMessage()}</p>
          <Progress value={progress} className="mt-3 h-2" />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {selectedFloor === "all" ? "Overall AI Confidence" : "Floor AI Confidence"}
          </p>
          <p className="font-display text-3xl font-bold text-accent">
            {displayConfidence !== "—" ? `${displayConfidence}%` : "—"}
          </p>
        </div>
      </div>

      {ready && d.floors && d.floors.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2 justify-center border-b pb-4">
          <button
            onClick={() => setSelectedFloor("all")}
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-xs font-bold transition-all border",
              selectedFloor === "all"
                ? "bg-accent text-accent-foreground border-transparent shadow"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border-border"
            )}
          >
            All Floors Combined
          </button>
          {d.floors.map((fl) => (
            <button
              key={fl.floor}
              onClick={() => setSelectedFloor(fl.floor)}
              type="button"
              className={cn(
                "rounded-lg px-4 py-2 text-xs font-bold transition-all border",
                selectedFloor === fl.floor
                  ? "bg-accent text-accent-foreground border-transparent shadow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted border-border"
              )}
            >
              {fl.floorName}
            </button>
          ))}
        </div>
      )}

      {!displayDetections ? (
        <div className="surface-panel flex items-center justify-center gap-3 p-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Loading detection results…
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <DetectionPanel
            title="Civil Drawing"
            items={displayDetections.civil}
            confidence={displayDetections.confidence.civil}
          />
          <DetectionPanel
            title="Electrical Drawing"
            items={displayDetections.electrical}
            confidence={displayDetections.confidence.electrical}
          />
          <DetectionPanel
            title="Mechanical Drawing"
            items={displayDetections.mechanical}
            confidence={displayDetections.confidence.mechanical}
          />
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/projects/$id/upload" params={{ id }}>
            Back
          </Link>
        </Button>
        <Button
          disabled={!ready}
          onClick={() => navigate({ to: "/projects/$id/quantities", params: { id } })}
        >
          Continue to Material Quantities
        </Button>
      </div>
    </AppShell>
  );
}

function DetectionPanel({
  title,
  items,
  confidence,
}: {
  title: string;
  items: Detections["civil"];
  confidence: number;
}) {
  return (
    <div className="surface-panel animate-rise overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/50 px-5 py-3">
        <p className="text-sm font-bold">{title}</p>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
          {confidence}%
        </span>
      </div>
      <div className="space-y-4 p-5">
        {Object.entries(items).map(([name, count]) => {
          const max = Math.max(...Object.values(items));
          return (
            <div key={name}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{name}</span>
                <span className="font-semibold">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-accent transition-all duration-700"
                  style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
