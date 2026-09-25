import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import {
  fetchEstimation,
  fetchMaterials,
  fetchProject,
  getOrCreateDetections,
  getQuantities,
  saveEstimation,
  type Material,
} from "@/lib/workflow";
import {
  computeCostBreakdown,
  formatINR,
  formatNumber,
  materialOrder,
  materialUnits,
} from "@/lib/estimator";
import { buildEstimationPdf } from "@/lib/pdf";
import { supabase } from "@/integrations/supabase/client";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$id/cost")({
  head: () => ({
    meta: [
      { title: "Cost Estimation Report — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Full construction cost breakdown covering materials, labour, equipment, transportation, GST and contingency, with a downloadable PDF report.",
      },
      { property: "og:title", content: "Construction Cost Breakdown" },
      {
        property: "og:description",
        content: "Detailed project cost with GST, labour and contingency plus PDF export.",
      },
    ],
  }),
  component: CostPage,
});

function CostPage() {
  const { id } = Route.useParams();
  const [downloading, setDownloading] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const materials = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });
  const estimation = useQuery({ queryKey: ["estimation", id], queryFn: () => fetchEstimation(id) });
  const quantities = useQuery({
    queryKey: ["quantities", id],
    enabled: !!project.data,
    queryFn: () => getQuantities(project.data!),
  });
  const detections = useQuery({
    queryKey: ["detections", id],
    enabled: !!project.data,
    queryFn: () => getOrCreateDetections(project.data!),
  });

  const selections = (estimation.data?.selections ?? {}) as Record<string, string>;

  const selected = useMemo(() => {
    const map: Record<string, Material | undefined> = {};
    for (const key of materialOrder) {
      const list = (materials.data ?? []).filter((m) => m.category === key);
      map[key] = list.find((m) => m.id === selections[key]) ?? list[0];
    }
    return map;
  }, [materials.data, estimation.data]);

  const materialCost = materialOrder.reduce((sum, key) => {
    const m = selected[key];
    const qty = quantities.data?.[key] ?? 0;
    return sum + (m ? qty * Number(m.price) : 0);
  }, 0);

  const breakdown = useMemo(() => {
    const baseBreakdown = computeCostBreakdown(materialCost);
    if (quantities.data?.floors) {
      const floorBreakdowns = quantities.data.floors.map((fq) => {
        const floorMaterialCost = materialOrder.reduce((sum, key) => {
          const m = selected[key];
          const qty = fq.quantities[key] ?? 0;
          return sum + (m ? qty * Number(m.price) : 0);
        }, 0);
        const floorCostBreakdown = computeCostBreakdown(floorMaterialCost);
        return {
          floor: fq.floor,
          floorName: fq.floorName,
          breakdown: floorCostBreakdown,
        };
      });
      return {
        ...baseBreakdown,
        floors: floorBreakdowns,
      };
    }
    return baseBreakdown;
  }, [materialCost, quantities.data, selected]);

  const displayBreakdown = useMemo(() => {
    if (selectedFloor === "all" || !breakdown.floors) {
      return breakdown;
    }
    return breakdown.floors.find((fl) => fl.floor === selectedFloor)?.breakdown ?? breakdown;
  }, [breakdown, selectedFloor]);

  const displayQuantities = useMemo(() => {
    if (!quantities.data) return null;
    if (selectedFloor === "all" || !quantities.data.floors) {
      return quantities.data;
    }
    return quantities.data.floors.find((fl) => fl.floor === selectedFloor)?.quantities ?? quantities.data;
  }, [quantities.data, selectedFloor]);

  const ready = !!project.data && !!quantities.data && !!materials.data && !!detections.data;

  useEffect(() => {
    if (!ready || !project.data) return;
    void saveEstimation(project.data, {
      quantities: quantities.data,
      breakdown: breakdown as unknown as Record<string, number>,
      total_cost: breakdown.total,
    });
    void supabase.from("projects").update({ 
      status: "Estimated", 
      estimated_cost: breakdown.total 
    }).eq("id", project.data.id);
  }, [ready, breakdown.total]);

  const download = async () => {
    if (!project.data || !quantities.data || !detections.data) return;
    setDownloading(true);
    try {
      const doc = buildEstimationPdf({
        project: project.data,
        detections: detections.data,
        quantities: quantities.data,
        selected,
        breakdown,
      });
      const fileName = `${project.data.project_name.replace(/\s+/g, "-")}-estimate.pdf`;
      doc.save(fileName);
      await supabase.from("reports").insert({
        project_id: project.data.id,
        user_id: project.data.user_id,
        report_name: fileName,
      });
      toast.success("Report downloaded");
    } catch (e) {
      toast.error("Could not generate the report");
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const rows = [
    { label: "Material Cost", value: displayBreakdown.materialCost },
    { label: "Labour Charges (28%)", value: displayBreakdown.labor },
    { label: "Equipment & Machinery (9%)", value: displayBreakdown.equipment },
    { label: "Transportation (5%)", value: displayBreakdown.transportation },
    { label: "GST (18%)", value: displayBreakdown.gst },
    { label: "Contingency (5%)", value: displayBreakdown.contingency },
  ];

  const budget = Number(project.data?.budget ?? 0);
  const variance = budget ? breakdown.total - budget : 0;

  return (
    <AppShell
      title={project.data?.project_name ?? "Cost Estimation"}
      subtitle="Step 6 — Final cost breakdown & report"
    >
      <StepIndicator current={6} />

      {!ready ? (
        <div className="surface-panel flex items-center justify-center gap-3 p-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Preparing final estimate…
        </div>
      ) : (
        <>
          {quantities.data?.floors && quantities.data.floors.length > 0 && (
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
              {quantities.data.floors.map((fl) => (
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

          {selectedFloor === "all" && breakdown.floors && (
            <div className="surface-panel animate-rise p-6 mb-6">
              <p className="text-sm font-bold mb-4">Floor-wise Cost Summary</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 font-semibold">Floor</th>
                      <th className="pb-3 text-right font-semibold">Material Cost</th>
                      <th className="pb-3 text-right font-semibold">Labour Cost</th>
                      <th className="pb-3 text-right font-semibold">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.floors.map((fb) => (
                      <tr key={fb.floor} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{fb.floorName}</td>
                        <td className="py-2.5 text-right">{formatINR(fb.breakdown.materialCost)}</td>
                        <td className="py-2.5 text-right">{formatINR(fb.breakdown.labor)}</td>
                        <td className="py-2.5 text-right font-semibold text-accent">{formatINR(fb.breakdown.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="surface-panel animate-rise overflow-hidden">
              <div className="border-b bg-muted/50 px-6 py-4 flex items-center justify-between">
                <p className="text-sm font-bold">
                  {selectedFloor === "all" ? "Material-wise Costing (All Floors)" : `Material-wise Costing — ${breakdown.floors?.find(f => f.floor === selectedFloor)?.floorName}`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-semibold">Material</th>
                      <th className="px-6 py-3 font-semibold">Brand</th>
                      <th className="px-6 py-3 text-right font-semibold">Qty</th>
                      <th className="px-6 py-3 text-right font-semibold">Rate</th>
                      <th className="px-6 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialOrder.map((key) => {
                      const m = selected[key];
                      const qty = displayQuantities?.[key] ?? 0;
                      return (
                        <tr key={key} className="border-b last:border-0">
                          <td className="px-6 py-3 font-medium">{key}</td>
                          <td className="px-6 py-3 text-muted-foreground">{m?.brand ?? "—"}</td>
                          <td className="px-6 py-3 text-right">
                            {formatNumber(qty)}{" "}
                            <span className="text-xs text-muted-foreground">
                              {materialUnits[key]}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            {m ? formatINR(Number(m.price)) : "—"}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold">
                            {m ? formatINR(qty * Number(m.price)) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              <div className="surface-panel animate-rise p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground">
                    <IndianRupee className="size-5" />
                  </div>
                  <p className="text-sm font-bold">
                    {selectedFloor === "all" ? "Cost Breakdown (All Floors)" : `Cost Breakdown — ${breakdown.floors?.find(f => f.floor === selectedFloor)?.floorName}`}
                  </p>
                </div>
                <dl className="space-y-2.5 text-sm">
                  {rows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="font-medium">{formatINR(r.value)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-xl bg-gradient-navy p-5 text-primary-foreground">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {selectedFloor === "all" ? "Total Estimated Project Cost" : `Estimated Cost — ${breakdown.floors?.find(f => f.floor === selectedFloor)?.floorName}`}
                  </p>
                  <p className="font-display text-3xl font-bold">{formatINR(displayBreakdown.total)}</p>
                  {selectedFloor === "all" && budget > 0 && (
                    <p className="mt-2 text-xs opacity-90">
                      {variance > 0
                        ? `${formatINR(variance)} over the declared budget`
                        : `${formatINR(Math.abs(variance))} under the declared budget`}
                    </p>
                  )}
                </div>
                {selectedFloor === "all" && (
                  <Button className="mt-5 w-full" onClick={download} disabled={downloading}>
                    {downloading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 size-4" />
                    )}
                    Download PDF Report
                  </Button>
                )}
              </div>

              <div className="surface-panel animate-rise p-6">
                <p className="text-sm font-bold">Project Summary</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <SummaryRow label="Building Type" value={project.data?.building_type ?? "—"} />
                  <SummaryRow label="Floors" value={String(project.data?.floors ?? "—")} />
                  <SummaryRow
                    label="Built-up Area"
                    value={`${formatNumber(Number(project.data?.area ?? 0))} sq.ft`}
                  />
                  <SummaryRow
                    label="Cost / sq.ft"
                    value={formatINR(
                      displayBreakdown.total / Math.max(1, Number(project.data?.area ?? 1)),
                    )}
                  />
                </dl>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/projects/$id/materials" params={{ id }}>
              Back
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
        <Button asChild>
          <Link to="/projects/$id/progress" params={{ id }}>
            Continue to Track Progress →
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
