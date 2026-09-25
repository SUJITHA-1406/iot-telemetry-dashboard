import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { fetchProject, getQuantities, saveEstimation } from "@/lib/workflow";
import { formatNumber, materialOrder, materialUnits } from "@/lib/estimator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$id/quantities")({
  head: () => ({
    meta: [
      { title: "Material Quantities — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Automatic quantity take-off for cement bags, steel weight, brick count, sand, concrete, paint, wiring and PVC piping.",
      },
      { property: "og:title", content: "Material Quantity Estimation" },
      {
        property: "og:description",
        content: "AI-derived construction material quantities for your project.",
      },
    ],
  }),
  component: QuantitiesPage,
});

const accents: Record<string, string> = {
  Cement: "from-chart-2/20",
  Steel: "from-chart-1/20",
};

function QuantitiesPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");

  const project = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const quantities = useQuery({
    queryKey: ["quantities", id],
    enabled: !!project.data,
    queryFn: () => getQuantities(project.data!),
  });

  useEffect(() => {
    if (project.data && quantities.data) {
      void saveEstimation(project.data, { quantities: quantities.data });
    }
  }, [project.data, quantities.data]);

  const displayQuantities = quantities.data
    ? selectedFloor === "all"
      ? quantities.data
      : quantities.data.floors?.find((fl) => fl.floor === selectedFloor)?.quantities ?? quantities.data
    : null;

  return (
    <AppShell
      title={project.data?.project_name ?? "Material Quantities"}
      subtitle="Step 4 — Automatic quantity take-off"
    >
      <StepIndicator current={4} />

      <div className="surface-panel animate-rise mb-6 flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
          <Layers className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold">Quantity take-off derived from AI detections</p>
          <p className="text-xs text-muted-foreground">
            Wall area → brick count → cement &amp; sand; structural volume → concrete &amp; steel.
          </p>
        </div>
      </div>

      {quantities.isLoading || !displayQuantities ? (
        <div className="surface-panel flex items-center justify-center gap-3 p-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Calculating quantities…
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {materialOrder.map((key, i) => (
              <div
                key={key}
                className={`surface-panel hover-lift animate-rise bg-gradient-to-br ${
                  accents[key] ?? "from-accent/10"
                } to-transparent p-5`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {key}
                </p>
                <p className="mt-3 font-display text-2xl font-bold">
                  {formatNumber(displayQuantities[key])}
                </p>
                <p className="text-xs text-muted-foreground">{materialUnits[key]}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/projects/$id/analysis" params={{ id }}>
            Back
          </Link>
        </Button>
        <Button
          disabled={!quantities.data}
          onClick={() => navigate({ to: "/projects/$id/materials", params: { id } })}
        >
          Select Material Brands
        </Button>
      </div>
    </AppShell>
  );
}
