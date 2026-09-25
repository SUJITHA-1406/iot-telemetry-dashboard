import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, generateUUID } from "@/lib/auth-service";
import { saveLocalProject, type Project } from "@/lib/workflow";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [
      { title: "New Project — Smart Construction Estimator" },
      {
        name: "description",
        content:
          "Create a new construction estimation project with building type, floors, built-up area, foundation and roof details.",
      },
      { property: "og:title", content: "Create a Construction Project" },
      {
        property: "og:description",
        content: "Start a six-step AI-assisted construction cost estimate.",
      },
    ],
  }),
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    owner_name: "",
    location: "",
    building_type: "Residential",
    floors: "2",
    area: "1800",
    foundation: "Raft Foundation",
    roof: "RCC Flat Slab",
    budget: "3500000",
    start_date: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const currentUser = await getCurrentUser();
    const userId = currentUser?.id || generateUUID();

    const newProject: Project = {
      id: generateUUID(),
      user_id: userId,
      project_name: form.project_name.trim() || "New Construction Project",
      owner_name: form.owner_name.trim() || "Owner",
      location: form.location.trim() || "Tamil Nadu",
      building_type: form.building_type,
      floors: Number(form.floors) || 1,
      area: Number(form.area) || 1000,
      foundation: form.foundation,
      roof: form.roof,
      budget: Number(form.budget) || 0,
      start_date: form.start_date || new Date().toISOString().split("T")[0],
      status: "Details Saved",
      estimated_cost: Number(form.budget) || 3500000,
      created_at: new Date().toISOString(),
    };

    saveLocalProject(newProject);

    try {
      const { data } = await supabase
        .from("projects")
        .insert({
          id: newProject.id,
          user_id: userId,
          project_name: newProject.project_name,
          owner_name: newProject.owner_name,
          location: newProject.location,
          building_type: newProject.building_type,
          floors: newProject.floors,
          area: newProject.area,
          foundation: newProject.foundation,
          roof: newProject.roof,
          budget: newProject.budget,
          start_date: newProject.start_date,
          status: newProject.status,
        })
        .select("id")
        .single();

      if (data?.id) {
        newProject.id = data.id;
        saveLocalProject(newProject);
      }
    } catch (err) {
      console.warn("Supabase insert notice:", err);
    }

    setBusy(false);
    toast.success("Project information saved!");
    navigate({ to: "/projects/$id/upload", params: { id: newProject.id } });
  };

  return (
    <AppShell title="New Project" subtitle="Step 1 — Project information">
      <StepIndicator current={1} />

      <form onSubmit={submit} className="surface-panel animate-rise p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-navy text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">Project Information</h2>
            <p className="text-xs text-muted-foreground">
              These parameters drive the AI take-off and cost model.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Project Name" id="project_name">
            <Input
              id="project_name"
              required
              value={form.project_name}
              onChange={(e) => set("project_name", e.target.value)}
              placeholder="Skyline Residency Block A"
            />
          </Field>
          <Field label="Owner Name" id="owner_name">
            <Input
              id="owner_name"
              required
              value={form.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
              placeholder="R. Sharma"
            />
          </Field>
          <Field label="Location" id="location">
            <Input
              id="location"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Coimbatore, Tamil Nadu"
            />
          </Field>
          <Field label="Building Type" id="building_type">
            <Select value={form.building_type} onValueChange={(v) => set("building_type", v)}>
              <SelectTrigger id="building_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Residential">Residential</SelectItem>
                <SelectItem value="Commercial">Commercial</SelectItem>
                <SelectItem value="Industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number of Floors" id="floors">
            <Input
              id="floors"
              type="number"
              min={1}
              value={form.floors}
              onChange={(e) => set("floors", e.target.value)}
            />
          </Field>
          <Field label="Built-up Area (sq.ft)" id="area">
            <Input
              id="area"
              type="number"
              min={100}
              value={form.area}
              onChange={(e) => set("area", e.target.value)}
            />
          </Field>
          <Field label="Foundation Type" id="foundation">
            <Select value={form.foundation} onValueChange={(v) => set("foundation", v)}>
              <SelectTrigger id="foundation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Raft Foundation", "Isolated Footing", "Pile Foundation", "Strip Footing"].map(
                  (o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Roof Type" id="roof">
            <Select value={form.roof} onValueChange={(v) => set("roof", v)}>
              <SelectTrigger id="roof">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["RCC Flat Slab", "Sloped Truss Roof", "Metal Sheet Roof", "Shell Roof"].map(
                  (o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estimated Budget (₹)" id="budget">
            <Input
              id="budget"
              type="number"
              min={0}
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </Field>
          <Field label="Construction Start Date" id="start_date">
            <Input
              id="start_date"
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-8 flex justify-between gap-3">
          <Button type="button" variant="ghost" asChild>
            <Link to="/dashboard">Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save & Upload Drawings
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
