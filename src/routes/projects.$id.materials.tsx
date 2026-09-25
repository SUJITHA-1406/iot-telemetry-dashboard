import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchEstimation,
  fetchMaterials,
  fetchProject,
  getQuantities,
  saveEstimation,
  type Material,
} from "@/lib/workflow";
import { formatINR, formatNumber, materialOrder, materialUnits } from "@/lib/estimator";

export const Route = createFileRoute("/projects/$id/materials")({
  head: () => ({
    meta: [
      { title: "Material Selection — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Choose preferred brands and quality grades for cement, steel, bricks, sand, concrete, paint, wire and PVC pipe at live market prices.",
      },
      { property: "og:title", content: "Select Material Brands" },
      {
        property: "og:description",
        content: "Real market brands with instant cost recalculation for every material.",
      },
    ],
  }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<Record<string, string>>({});

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const materials = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });
  const quantities = useQuery({
    queryKey: ["quantities", id],
    enabled: !!project.data,
    queryFn: () => getQuantities(project.data!),
  });
  const estimation = useQuery({
    queryKey: ["estimation", id],
    queryFn: () => fetchEstimation(id),
  });

  const byCategory = useMemo(() => {
    const map: Record<string, Material[]> = {};
    for (const m of materials.data ?? []) {
      (map[m.category] ||= []).push(m);
    }
    return map;
  }, [materials.data]);

  useEffect(() => {
    if (!materials.data?.length) return;
    setSelections((prev) => {
      if (Object.keys(prev).length) return prev;
      const stored = (estimation.data?.selections ?? {}) as Record<string, string>;
      const next: Record<string, string> = {};
      for (const key of materialOrder) {
        const options = (materials.data ?? []).filter((m) => m.category === key);
        const first = options[0];
        next[key] = stored[key] && options.some((o) => o.id === stored[key]) ? stored[key] : first?.id ?? "";
      }
      return next;
    });
  }, [materials.data, estimation.data]);

  const selected = useMemo(() => {
    const map: Record<string, Material | undefined> = {};
    for (const key of materialOrder) {
      map[key] = (materials.data ?? []).find((m) => m.id === selections[key]);
    }
    return map;
  }, [materials.data, selections]);

  const materialCost = materialOrder.reduce((sum, key) => {
    const m = selected[key];
    const qty = quantities.data?.[key] ?? 0;
    return sum + (m ? qty * Number(m.price) : 0);
  }, 0);

  const proceed = async () => {
    if (!project.data || !quantities.data) return;
    await saveEstimation(project.data, { quantities: quantities.data, selections });
    navigate({ to: "/projects/$id/cost", params: { id } });
  };

  const loading = materials.isLoading || quantities.isLoading;

  return (
    <AppShell
      title={project.data?.project_name ?? "Material Selection"}
      subtitle="Step 5 — Brand and quality selection"
    >
      <StepIndicator current={5} />

      <div className="surface-panel animate-rise mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
            <PackageSearch className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Live market brand catalogue</p>
            <p className="text-xs text-muted-foreground">
              Changing a brand instantly recalculates the material cost.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Running Material Cost
          </p>
          <p className="font-display text-2xl font-bold text-accent">{formatINR(materialCost)}</p>
        </div>
      </div>

      {loading ? (
        <div className="surface-panel flex items-center justify-center gap-3 p-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Loading market prices…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {materialOrder.map((key, i) => {
            const options = byCategory[key] ?? [];
            const m = selected[key];
            const qty = quantities.data?.[key] ?? 0;
            return (
              <div
                key={key}
                className="surface-panel hover-lift animate-rise p-5"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold">{key}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(qty)} {materialUnits[key]}
                  </p>
                </div>

                <Select
                  value={selections[key] ?? ""}
                  onValueChange={(v) => setSelections((s) => ({ ...s, [key]: v }))}
                >
                  <SelectTrigger className="mt-4">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.brand} — {o.quality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <dl className="mt-4 space-y-1.5 text-xs">
                  <Row label="Unit" value={m?.unit ?? "—"} />
                  <Row label="Rate" value={m ? formatINR(Number(m.price)) : "—"} />
                  <Row label="Availability" value="In stock" />
                </dl>

                <div className="mt-4 rounded-lg bg-muted/70 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Estimated Cost
                  </p>
                  <p className="font-display text-lg font-bold">
                    {m ? formatINR(qty * Number(m.price)) : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/projects/$id/quantities" params={{ id }}>
            Back
          </Link>
        </Button>
        <Button onClick={proceed} disabled={loading}>
          Calculate Construction Cost
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
