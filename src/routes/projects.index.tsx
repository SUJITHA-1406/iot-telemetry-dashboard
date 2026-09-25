import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { 
  FolderKanban, 
  Search, 
  ArrowUpRight, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  MapPin, 
  Building2, 
  Layers 
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { fetchProjects } from "@/lib/workflow";
import { formatINR, formatNumber, getStatusProgress } from "@/lib/estimator";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "View Projects — Smart Construction Estimator" },
      {
        name: "description",
        content: "Track your ongoing and completed construction estimation projects.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState("ongoing");

  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const list = projects.data ?? [];
  const filtered = useMemo(() => {
    return list.filter((p) =>
      [p.project_name, p.owner_name, p.location, p.building_type]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [list, q]);

  const { ongoing, completed } = useMemo(() => {
    const og: typeof list = [];
    const cp: typeof list = [];
    for (const p of filtered) {
      if (p.status === "Completed") {
        cp.push(p);
      } else {
        og.push(p);
      }
    }
    return { ongoing: og, completed: cp };
  }, [filtered]);

  // Loading skeleton layout
  const renderSkeletons = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="surface-panel p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AppShell
      title="Projects"
      subtitle="View and manage all your construction estimation projects"
      actions={
        <Button asChild size="sm">
          <Link to="/projects/new">New Project</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center bg-card p-4 rounded-xl border">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects by name, owner, type or location..."
              className="pl-9 w-full"
            />
          </div>
        </div>

        {projects.isLoading ? (
          renderSkeletons()
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
              <TabsTrigger value="ongoing" className="relative">
                Currently Going
                {ongoing.length > 0 && (
                  <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent">
                    {ongoing.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Already Done
                {completed.length > 0 && (
                  <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] bg-success/20 text-success">
                    {completed.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ongoing" className="space-y-4">
              {ongoing.length === 0 ? (
                <div className="surface-panel p-12 text-center text-muted-foreground">
                  <FolderKanban className="mx-auto size-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-base text-foreground">No active projects</h3>
                  <p className="text-sm mt-1 mb-4">You do not have any projects in progress right now.</p>
                  <Button asChild>
                    <Link to="/projects/new">Create a Project</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {ongoing.map((p, idx) => (
                    <ProjectCard key={p.id} project={p} delay={idx * 50} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completed.length === 0 ? (
                <div className="surface-panel p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto size-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-bold text-base text-foreground">No completed projects</h3>
                  <p className="text-sm mt-1">When you mark a project's construction stage as 'Completed', it will show up here.</p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {completed.map((p, idx) => (
                    <ProjectCard key={p.id} project={p} delay={idx * 50} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

function ProjectCard({ project, delay }: { project: any; delay: number }) {
  const totalCost = Number(project.estimated_cost || project.budget || 0);
  const progress = getStatusProgress(project.status);
  const progressCost = totalCost * (progress / 100);

  // Determine button routes based on project stage
  const getActionLinks = () => {
    const isNew = project.status === "Details Saved" || project.status === "Draft";
    
    return (
      <div className="flex gap-2 w-full pt-2">
        {isNew ? (
          <Button asChild size="sm" className="w-full">
            <Link to="/projects/$id/upload" params={{ id: project.id }}>
              Upload Drawings
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/projects/$id/cost" params={{ id: project.id }}>
                Cost Estimate
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link to="/projects/$id/progress" params={{ id: project.id }}>
                Track Progress
              </Link>
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      className="surface-panel hover-lift animate-rise p-6 flex flex-col justify-between"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground truncate max-w-[240px]">
              {project.project_name}
            </h3>
            <p className="text-xs text-muted-foreground font-medium">Owner: {project.owner_name}</p>
          </div>
          <Badge variant={project.status === "Completed" ? "default" : "secondary"} className="shrink-0">
            {project.status}
          </Badge>
        </div>

        {/* Project Meta Info */}
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-y py-3">
          <div className="flex items-center gap-1.5">
            <Building2 className="size-3.5 text-accent shrink-0" />
            <span className="truncate">{project.building_type}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-accent shrink-0" />
            <span>{project.floors} Floors ({formatNumber(project.area)} sq.ft)</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <MapPin className="size-3.5 text-accent shrink-0" />
            <span className="truncate">{project.location || "Location not set"}</span>
          </div>
        </div>

        {/* Progress Display */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="flex items-center gap-1">
              <TrendingUp className="size-3 text-accent" /> Construction Progress
            </span>
            <span className="text-accent">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Financial Info */}
        <div className="bg-muted/50 rounded-xl p-3 flex justify-between items-center border">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Cost by Progress
            </span>
            <span className="font-display font-bold text-base text-success">
              {formatINR(progressCost)}
            </span>
          </div>
          <div className="text-right border-l pl-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Total Budgeted
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {formatINR(totalCost)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 border-t pt-4">
        {getActionLinks()}
      </div>
    </div>
  );
}

export default ProjectsPage;
