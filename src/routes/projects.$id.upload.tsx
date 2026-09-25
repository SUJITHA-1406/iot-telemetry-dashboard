import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { UploadCloud, FileCheck2, Loader2, Zap, Cable, Wind, Layers } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth-service";
import { fetchDrawings, fetchProject, saveLocalDrawing } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$id/upload")({
  head: () => ({
    meta: [
      { title: "Upload Drawings — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Upload civil, electrical and mechanical engineering drawings in PDF, PNG, JPG or JPEG for AI blueprint analysis.",
      },
      { property: "og:title", content: "Upload Engineering Drawings" },
      {
        property: "og:description",
        content: "Drag and drop civil, electrical and mechanical blueprints for AI analysis.",
      },
    ],
  }),
  component: UploadPage,
});

const categories = [
  { key: "civil", label: "Civil Drawing", icon: Cable, hint: "Plans, sections, structural layout" },
  { key: "electrical", label: "Electrical Drawing", icon: Zap, hint: "Wiring, DB, lighting layout" },
  { key: "mechanical", label: "Mechanical Drawing", icon: Wind, hint: "Plumbing, HVAC, fire lines" },
] as const;

function UploadPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const drawings = useQuery({ queryKey: ["drawings", id], queryFn: () => fetchDrawings(id) });

  const uploaded = new Set((drawings.data ?? []).map((d) => (d as { category: string }).category));

  const isMultiFloor = project.data ? project.data.floors > 1 : false;
  const [uploadMode, setUploadMode] = useState<"combined" | "individual">("combined");

  useEffect(() => {
    if (drawings.data && drawings.data.length > 0) {
      const cats = drawings.data.map((d: any) => d.category);
      if (cats.includes("combined")) {
        setUploadMode("combined");
      } else if (cats.includes("civil") || cats.includes("electrical") || cats.includes("mechanical")) {
        setUploadMode("individual");
      }
    }
  }, [drawings.data]);

  const canContinue = isMultiFloor
    ? uploadMode === "combined"
      ? uploaded.has("combined")
      : (uploaded.has("civil") || uploaded.has("electrical") || uploaded.has("mechanical"))
    : (uploaded.has("civil") || uploaded.has("electrical") || uploaded.has("mechanical"));

  const [loadingSample, setLoadingSample] = useState(false);

  const loadSampleDrawings = async () => {
    setLoadingSample(true);
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser?.id || "demo-user";
      
      const sampleItems = isMultiFloor && uploadMode === "combined"
        ? [
            {
              category: "combined",
              file_name: `${project.data?.project_name || "Building"}_MultiFloor_Blueprint.pdf`,
              file_path: `${userId}/combined/${id}-sample-combined.pdf`,
            }
          ]
        : [
            {
              category: "civil",
              file_name: `${project.data?.project_name || "Building"}_Civil_Structural_Layout.pdf`,
              file_path: `${userId}/civil/${id}-sample-civil.pdf`,
            },
            {
              category: "electrical",
              file_name: `${project.data?.project_name || "Building"}_Electrical_Wiring_Plan.pdf`,
              file_path: `${userId}/electrical/${id}-sample-elec.pdf`,
            },
            {
              category: "mechanical",
              file_name: `${project.data?.project_name || "Building"}_Plumbing_HVAC_Schematic.pdf`,
              file_path: `${userId}/mechanical/${id}-sample-mech.pdf`,
            },
          ];

      for (const item of sampleItems) {
        const dRecord = {
          project_id: id,
          user_id: userId,
          category: item.category,
          file_name: item.file_name,
          file_path: item.file_path,
          created_at: new Date().toISOString(),
        };
        saveLocalDrawing(id, dRecord);
        try {
          await supabase.from("drawings").insert(dRecord);
        } catch (e) {
          // background sync
        }
      }

      await supabase.from("ai_results").delete().eq("project_id", id);
      await supabase.from("estimation_results").delete().eq("project_id", id);

      qc.invalidateQueries({ queryKey: ["drawings", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
      toast.success("Sample architectural blueprints attached!");
    } catch (e: any) {
      toast.error(e.message || "Failed to load sample drawings");
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <AppShell
      title={project.data?.project_name ?? "Upload Drawings"}
      subtitle="Step 2 — Engineering drawing upload"
    >
      <StepIndicator current={2} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {isMultiFloor && (
          <div className="inline-flex rounded-lg bg-muted p-1 border">
            <button
              onClick={() => setUploadMode("combined")}
              type="button"
              className={cn(
                "rounded-md px-4 py-2 text-xs font-bold transition-all",
                uploadMode === "combined"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Combined Multi-Floor Blueprint (Single PDF/Image)
            </button>
            <button
              onClick={() => setUploadMode("individual")}
              type="button"
              className={cn(
                "rounded-md px-4 py-2 text-xs font-bold transition-all",
                uploadMode === "individual"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Individual Drawings (Civil/Elec/Mech)
            </button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={loadSampleDrawings}
          disabled={loadingSample}
          className="ml-auto text-xs"
        >
          {loadingSample ? (
            <Loader2 className="mr-2 size-3.5 animate-spin" />
          ) : (
            <Layers className="mr-2 size-3.5" />
          )}
          Load Sample Blueprint Dataset
        </Button>
      </div>

      {isMultiFloor && uploadMode === "combined" ? (
        <div className="mx-auto max-w-xl">
          <UploadCard
            category="combined"
            label="Combined Multi-Floor Drawing"
            hint="Upload a single PDF or image containing the blueprints of all floors"
            Icon={Layers}
            projectId={id}
            done={uploaded.has("combined")}
            fileName={
              (drawings.data ?? []).find((d) => (d as { category: string }).category === "combined")
                ?.file_name as string | undefined
            }
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["drawings", id] });
              qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
              qc.invalidateQueries({ queryKey: ["detections", id] });
              qc.invalidateQueries({ queryKey: ["quantities", id] });
              qc.invalidateQueries({ queryKey: ["estimation", id] });
            }}
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {categories.map((c) => (
            <UploadCard
              key={c.key}
              category={c.key}
              label={c.label}
              hint={c.hint}
              Icon={c.icon}
              projectId={id}
              done={uploaded.has(c.key)}
              fileName={
                (drawings.data ?? []).find((d) => (d as { category: string }).category === c.key)
                  ?.file_name as string | undefined
              }
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["drawings", id] });
                qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
                qc.invalidateQueries({ queryKey: ["detections", id] });
                qc.invalidateQueries({ queryKey: ["quantities", id] });
                qc.invalidateQueries({ queryKey: ["estimation", id] });
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/projects/new">Back</Link>
        </Button>
        <Button
          onClick={() => navigate({ to: "/projects/$id/analysis", params: { id } })}
          disabled={!canContinue}
        >
          Run AI Blueprint Analysis
        </Button>
      </div>
    </AppShell>
  );
}

function UploadCard({
  category,
  label,
  hint,
  Icon,
  projectId,
  done,
  fileName,
  onDone,
}: {
  category: string;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  projectId: string;
  done: boolean;
  fileName?: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      toast.error("Only PDF, PNG, JPG and JPEG files are supported");
      return;
    }
    setBusy(true);
    try {
      const currentUser = await getCurrentUser();
      const userId = currentUser?.id || "demo-user";
      const path = `${userId}/${category}/${projectId}-${Date.now()}-${file.name}`;
      try {
        const { error: upErr } = await supabase.storage.from("drawings").upload(path, file, { upsert: true });
        if (upErr) {
          console.warn("Storage upload notice:", upErr.message);
        }
      } catch (e) {
        console.warn("Storage upload error caught:", e);
      }

      const drawingRecord = {
        project_id: projectId,
        user_id: userId,
        category,
        file_name: file.name,
        file_path: path,
        created_at: new Date().toISOString(),
      };

      saveLocalDrawing(projectId, drawingRecord);

      try {
        await supabase.from("drawings").insert(drawingRecord);
        await supabase.from("ai_results").delete().eq("project_id", projectId);
        await supabase.from("estimation_results").delete().eq("project_id", projectId);
      } catch (err) {
        console.warn("Supabase insert notice:", err);
      }

      setBusy(false);
      toast.success(`${label} uploaded successfully!`);
      onDone();
    } catch (err: any) {
      setBusy(false);
      toast.error(err.message || "Failed to upload drawing");
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
      className={cn(
        "surface-panel hover-lift animate-rise flex flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
        drag && "border-accent bg-accent/5",
        done && "border-success/50",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl text-primary-foreground",
          done ? "bg-success" : "bg-gradient-navy",
        )}
      >
        {done ? <FileCheck2 className="size-6" /> : <Icon className="size-6" />}
      </div>
      <p className="mt-4 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      {done ? (
        <p className="mt-3 max-w-full truncate text-xs font-medium text-success">{fileName}</p>
      ) : (
        <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          PDF · PNG · JPG · JPEG
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <Button
        variant={done ? "outline" : "default"}
        size="sm"
        className="mt-5"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <UploadCloud className="mr-2 size-4" />
        )}
        {done ? "Replace file" : "Choose or drop file"}
      </Button>
    </div>
  );
}
