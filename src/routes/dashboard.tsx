import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  FileBarChart2,
  UploadCloud,
  IndianRupee,
  Search,
  ArrowUpRight,
  PlusCircle,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjects } from "@/lib/workflow";
import { formatINR, getStatusProgress } from "@/lib/estimator";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Track projects, drawings uploaded, reports generated and total estimated project value in one construction estimation dashboard.",
      },
      { property: "og:title", content: "Estimation Dashboard" },
      {
        property: "og:description",
        content: "Live overview of your construction estimation projects and their values.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [q, setQ] = useState("");

  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const counts = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const [drawings, reports] = await Promise.all([
        supabase.from("drawings").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
      ]);
      return { drawings: drawings.count ?? 0, reports: reports.count ?? 0 };
    },
  });

  const dbError = (projects.error as any)?.message || (counts.error as any)?.message || "";
  const isDbMissing = dbError.toLowerCase().includes("relation") && dbError.toLowerCase().includes("does not exist");

  if (isDbMissing) {
    return (
      <AppShell title="Setup Required" subtitle="Initialize database tables">
        <div className="surface-panel animate-rise p-6 lg:p-8 max-w-2xl mx-auto border-destructive/50 border">
          <h2 className="text-xl font-bold text-destructive flex items-center gap-2">
            ⚠️ Database Tables Missing
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Your Supabase project is connected successfully, but the required database tables (<code>projects</code>, <code>drawings</code>, etc.) do not exist yet in your new project.
          </p>
          <div className="mt-5 rounded-lg bg-muted p-4 text-xs font-mono text-muted-foreground select-all max-h-48 overflow-y-auto">
            Please run the SQL migration file located at:
            <br />
            <span className="font-semibold text-foreground">supabase/migrations/20260731140314_685e27a2-62f3-4e21-afd6-a87021f9a840.sql</span>
            <br />
            in your Supabase SQL Editor.
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <h3 className="font-semibold text-sm">How to initialize:</h3>
            <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1">
              <li>Open your <strong>Supabase Dashboard</strong>.</li>
              <li>Go to the <strong>SQL Editor</strong> in the left sidebar.</li>
              <li>Click <strong>New query</strong>.</li>
              <li>Open the SQL migration file in this project, copy its entire contents, and paste it into the editor.</li>
              <li>Click <strong>Run</strong> at the bottom right.</li>
              <li>Create a new storage bucket named <strong>drawings</strong> under Storage in the sidebar (needed for blueprints).</li>
            </ol>
          </div>
          <Button 
            className="mt-6 w-full" 
            onClick={() => window.location.reload()}
          >
            Refresh Page After Setting Up
          </Button>
        </div>
      </AppShell>
    );
  }

  const list = projects.data ?? [];
  const totalValue = list.reduce((sum, p) => sum + Number(p.estimated_cost || 0), 0);
  const filtered = list.filter((p) =>
    [p.project_name, p.owner_name, p.location, p.building_type]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  const stats = [
    { label: "Total Projects", value: String(list.length), icon: FolderKanban },
    { label: "Reports Generated", value: String(counts.data?.reports ?? 0), icon: FileBarChart2 },
    { label: "Drawings Uploaded", value: String(counts.data?.drawings ?? 0), icon: UploadCloud },
    { label: "Estimated Project Value", value: formatINR(totalValue), icon: IndianRupee },
  ];

  return (
    <AppShell
      title="Dashboard"
      subtitle="Portfolio overview of all construction estimates"
      actions={
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/projects/new">
            <PlusCircle className="mr-2 size-4" /> New Project
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="surface-panel hover-lift animate-rise p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-accent text-accent-foreground">
                <s.icon className="size-4" />
              </div>
            </div>
            <p className="mt-4 font-display text-2xl font-bold">
              {projects.isLoading ? <Skeleton className="h-7 w-24" /> : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="surface-panel mt-6 animate-rise overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Recent Projects</h2>
            <p className="text-xs text-muted-foreground">Latest estimation activity</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Project</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Location</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Cost by Progress</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {projects.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    No projects yet.{" "}
                    <Link to="/projects/new" className="font-semibold text-accent hover:underline">
                      Create your first estimate
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-t transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{p.project_name}</p>
                      <p className="text-xs text-muted-foreground">{p.owner_name}</p>
                    </td>
                    <td className="px-5 py-3">{p.building_type}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.location || "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={p.status === "Completed" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {(() => {
                        const total = Number(p.estimated_cost || p.budget || 0);
                        const progress = getStatusProgress(p.status);
                        const progressCost = total * (progress / 100);
                        return (
                          <div className="flex flex-col items-end">
                            <span>{formatINR(progressCost)}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {progress > 0 ? `${progress}% of ${formatINR(total)}` : `Total: ${formatINR(total)}`}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/projects/$id/cost" params={{ id: p.id }}>
                          Open <ArrowUpRight className="ml-1 size-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
