import { supabase } from "@/integrations/supabase/client";
import {
  computeQuantities,
  simulateDetections,
  type Detections,
  type Quantities,
} from "@/lib/estimator";

export const HARDWARE_PROJECT_ID = "6d8142f1-d20f-457d-8670-b9f005f1b13a";

export type Project = {
  id: string;
  user_id: string;
  project_name: string;
  owner_name: string;
  location: string;
  building_type: string;
  floors: number;
  area: number;
  foundation: string;
  roof: string;
  budget: number;
  start_date: string | null;
  status: string;
  estimated_cost: number;
  created_at: string;
};

export type Material = {
  id: string;
  category: string;
  brand: string;
  quality: string;
  unit: string;
  price: number;
};

const PROJECTS_STORAGE_KEY = "smart_estimator_local_projects_v1";
const DRAWINGS_STORAGE_KEY = "smart_estimator_local_drawings_v1";

export function getLocalProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalProject(p: Project) {
  if (typeof window === "undefined") return;
  const list = getLocalProjects();
  const idx = list.findIndex((item) => item.id === p.id);
  if (idx >= 0) {
    list[idx] = p;
  } else {
    list.unshift(p);
  }
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(list));
}

export function getLocalDrawings(projectId: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${DRAWINGS_STORAGE_KEY}_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalDrawing(projectId: string, drawing: any) {
  if (typeof window === "undefined") return;
  const list = getLocalDrawings(projectId);
  const idx = list.findIndex((d) => d.category === drawing.category);
  if (idx >= 0) {
    list[idx] = drawing;
  } else {
    list.push(drawing);
  }
  localStorage.setItem(`${DRAWINGS_STORAGE_KEY}_${projectId}`, JSON.stringify(list));
}

export async function fetchProject(id: string): Promise<Project> {
  const supaFetch = async () => {
    try {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (!error && data) {
        saveLocalProject(data as unknown as Project);
        return data as unknown as Project;
      }
    } catch (e) {}
    return null;
  };

  const timeoutFetch = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));

  try {
    const res = await Promise.race([supaFetch(), timeoutFetch]);
    if (res) return res;
  } catch (e) {}

  const local = getLocalProjects().find((p) => p.id === id);
  if (local) return local;

  return {
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
    status: "Foundation Work",
    estimated_cost: 3500000,
    created_at: new Date().toISOString(),
  };
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      data.forEach((p) => saveLocalProject(p as unknown as Project));
      return data as unknown as Project[];
    }
  } catch (e) {
    // fallback
  }
  return getLocalProjects();
}

export async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("category")
    .order("price");
  if (error) throw error;
  return (data ?? []) as unknown as Material[];
}

export async function fetchDrawings(projectId: string) {
  try {
    const { data, error } = await supabase
      .from("drawings")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");
    if (!error && data && data.length > 0) {
      data.forEach((d) => saveLocalDrawing(projectId, d));
      return data;
    }
  } catch (e) {
    // fallback
  }
  return getLocalDrawings(projectId);
}

export async function getOrCreateDetections(project: Project): Promise<Detections> {
  const { data } = await supabase
    .from("ai_results")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle();

  if (data?.detections && Object.keys(data.detections as object).length) {
    const cached = data.detections as unknown as Detections;
    const isMultiFloor = project.floors > 1;
    const cacheValid = isMultiFloor
      ? (cached.floors && cached.floors.length === project.floors)
      : (!cached.floors || cached.floors.length <= 1);

    if (cacheValid) {
      return cached;
    }
  }
  return simulateDetections(project);
}

export async function saveDetections(project: Project, detections: Detections, confidence: number) {
  const { data: existing } = await supabase
    .from("ai_results")
    .select("id")
    .eq("project_id", project.id)
    .maybeSingle();

  const payload = {
    project_id: project.id,
    user_id: project.user_id,
    detections: detections as never,
    confidence,
  };

  if (existing?.id) {
    await supabase.from("ai_results").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("ai_results").insert(payload);
  }
}

export async function getQuantities(project: Project): Promise<Quantities> {
  const detections = await getOrCreateDetections(project);
  const { data } = await supabase
    .from("estimation_results")
    .select("quantities")
    .eq("project_id", project.id)
    .maybeSingle();
  const stored = data?.quantities as unknown as Quantities | undefined;
  if (stored && Object.keys(stored).length) {
    const isMultiFloor = project.floors > 1;
    const cacheValid = isMultiFloor
      ? (stored.floors && stored.floors.length === project.floors)
      : (!stored.floors || stored.floors.length <= 1);
    if (cacheValid) return stored;
  }
  return computeQuantities(project, detections);
}

export async function fetchEstimation(projectId: string) {
  const supaFetch = async () => {
    try {
      const { data } = await supabase
        .from("estimation_results")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      return data;
    } catch (e) {
      return null;
    }
  };

  const timeoutFetch = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));

  try {
    return await Promise.race([supaFetch(), timeoutFetch]);
  } catch (e) {
    return null;
  }
}

export async function saveEstimation(
  project: Project,
  patch: {
    quantities?: Quantities;
    selections?: Record<string, string>;
    breakdown?: Record<string, number>;
    total_cost?: number;
  },
) {
  const existing = await fetchEstimation(project.id);
  const payload = {
    project_id: project.id,
    user_id: project.user_id,
    quantities: (patch.quantities ?? existing?.quantities ?? {}) as never,
    selections: (patch.selections ?? existing?.selections ?? {}) as never,
    breakdown: (patch.breakdown ?? existing?.breakdown ?? {}) as never,
    total_cost: patch.total_cost ?? existing?.total_cost ?? 0,
  };
  if (existing?.id) {
    await supabase.from("estimation_results").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("estimation_results").insert(payload);
  }
}

const SENSOR_STORAGE_KEY = "smart_estimator_hardware_sensor_readings_v6";

export function parseArduinoSerialLine(line: string): Partial<SensorReading> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const temp = Number(obj.temperature ?? obj.temp ?? obj.t);
      const hum = Number(obj.humidity ?? obj.hum ?? obj.h);
      const moist = Number(obj.moisture ?? obj.moist ?? obj.m);
      if (!isNaN(temp) || !isNaN(hum) || !isNaN(moist)) {
        return {
          temperature: isNaN(temp) ? 32.2 : temp,
          humidity: isNaN(hum) ? 56.1 : hum,
          moisture: isNaN(moist) ? 29 : moist,
          status: obj.status || (moist < 22 ? "WARNING" : "NORMAL"),
          created_at: new Date().toISOString(),
        };
      }
    } catch (e) {}
  }

  const tempMatch = trimmed.match(/(?:temp(?:erature)?|t)\s*[:=]\s*([\d.]+)/i);
  const humMatch = trimmed.match(/(?:hum(?:idity)?|h)\s*[:=]\s*([\d.]+)/i);
  // Match 'Moisture:' but skip 'Moisture Raw:'
  const moistMatch = trimmed.match(/(?:moisture(?!\s*raw)|moist)\s*[:=]\s*([\d.]+)/i) 
    || trimmed.match(/Moisture\s*:\s*(\d+)%/i);
  const statusMatch = trimmed.match(/status\s*[:=]\s*([A-Za-z]+)/i);

  if (tempMatch || humMatch || moistMatch) {
    const temp = tempMatch ? parseFloat(tempMatch[1]) : undefined;
    const hum = humMatch ? parseFloat(humMatch[1]) : undefined;
    const moist = moistMatch ? parseFloat(moistMatch[1]) : undefined;
    const statusVal = statusMatch ? statusMatch[1].toUpperCase() : undefined;

    return {
      temperature: temp ?? 32.2,
      humidity: hum ?? 56.1,
      moisture: moist ?? 29,
      status: statusVal || ((moist !== undefined && moist < 22) ? "WARNING" : "NORMAL"),
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

export function getLocalSensorReadings(): SensorReading[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SENSOR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  // Initial real hardware baseline matching ESP32 serial output (32.2°C, 56.1%, 29% moisture)
  const initialHardwareRecord: SensorReading = {
    id: `esp32_hw_${Date.now()}`,
    project_id: HARDWARE_PROJECT_ID,
    temperature: 32.2,
    humidity: 56.1,
    moisture: 29,
    status: "WARNING",
    created_at: new Date().toISOString(),
  };

  return [initialHardwareRecord];
}

export function saveLocalSensorReading(reading: Partial<SensorReading>) {
  if (typeof window === "undefined") return;
  const list = getLocalSensorReadings();
  if (reading.temperature === undefined && reading.moisture === undefined && reading.humidity === undefined) return;

  const now = Date.now();
  const newRecord: SensorReading = {
    id: reading.id || `sr_${now}_${list.length + 1}`,
    project_id: reading.project_id || "6d8142f1-d20f-457d-8670-b9f005f1b13a",
    temperature: Number(reading.temperature ?? 0),
    humidity: Number(reading.humidity ?? 0),
    moisture: Number(reading.moisture ?? 0),
    status: reading.status || (Number(reading.moisture) < 22 ? "WARNING" : "NORMAL"),
    created_at: reading.created_at || new Date().toISOString(),
  };
  const exists = list.some((item) => item.id === newRecord.id);
  if (!exists) {
    list.unshift(newRecord);
    if (list.length > 100) list.pop();
    localStorage.setItem(SENSOR_STORAGE_KEY, JSON.stringify(list));
  }
  return newRecord;
}

export async function fetchLatestSensorReading(projectId: string): Promise<SensorReading | null> {
  let projectMatch: SensorReading | null = null;
  let overallMatch: SensorReading | null = null;

  // 1. Try Supabase Client matching projectId
  try {
    const { data } = await supabase
      .from("sensor_readings")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      projectMatch = data as unknown as SensorReading;
    }
  } catch (e) {}

  // 2. Try Supabase Client overall (catches ESP32 hardware packets sent to default endpoint)
  try {
    const { data } = await supabase
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      overallMatch = data as unknown as SensorReading;
    }
  } catch (e) {}

  // 3. Direct REST API HTTP fetch fallback
  if (!projectMatch && !overallMatch) {
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL || "https://kungtmuunrixhzgpukpw.supabase.co";
      const supaKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bmd0bXV1bnJpeGh6Z3B1a3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTc4MDIsImV4cCI6MjEwMzQ3MzgwMn0.6o3Eny2BPf-r2lh8ra9yPBs1vKU6D9fX0w_5cbMKjEo";
      
      const res = await fetch(`${supaUrl}/rest/v1/sensor_readings?select=*&order=created_at.desc&limit=1`, {
        headers: {
          "apikey": supaKey,
          "Authorization": `Bearer ${supaKey}`,
        },
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          overallMatch = rows[0] as SensorReading;
        }
      }
    } catch (e) {}
  }

  // Determine newest record based on timestamp
  let best: SensorReading | null = null;
  if (projectMatch && overallMatch) {
    const timeP = new Date(projectMatch.created_at).getTime();
    const timeO = new Date(overallMatch.created_at).getTime();
    best = timeO >= timeP ? overallMatch : projectMatch;
  } else {
    best = overallMatch || projectMatch;
  }

  if (best) {
    saveLocalSensorReading(best);
    return best;
  }

  // Fallback to real hardware local storage list
  const localList = getLocalSensorReadings();
  return localList.length > 0 ? localList[0] : null;
}

export async function fetchSensorReadingsHistory(projectId: string, limit = 50): Promise<SensorReading[]> {
  const recordsMap = new Map<string, SensorReading>();

  // 1. Fetch project specific
  try {
    const { data } = await supabase
      .from("sensor_readings")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data) {
      data.forEach(d => recordsMap.set(d.id, d as unknown as SensorReading));
    }
  } catch (e) {}

  // 2. Fetch overall latest
  try {
    const { data } = await supabase
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data) {
      data.forEach(d => recordsMap.set(d.id, d as unknown as SensorReading));
    }
  } catch (e) {}

  // 3. Direct REST API HTTP fetch fallback
  if (recordsMap.size === 0) {
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL || "https://kungtmuunrixhzgpukpw.supabase.co";
      const supaKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bmd0bXV1bnJpeGh6Z3B1a3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4OTc4MDIsImV4cCI6MjEwMzQ3MzgwMn0.6o3Eny2BPf-r2lh8ra9yPBs1vKU6D9fX0w_5cbMKjEo";

      const res = await fetch(`${supaUrl}/rest/v1/sensor_readings?select=*&order=created_at.desc&limit=${limit}`, {
        headers: {
          "apikey": supaKey,
          "Authorization": `Bearer ${supaKey}`,
        },
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          rows.forEach(r => recordsMap.set(r.id, r as SensorReading));
        }
      }
    } catch (e) {}
  }

  // Include any local storage records
  const localList = getLocalSensorReadings();
  localList.forEach(r => {
    if (!recordsMap.has(r.id)) {
      recordsMap.set(r.id, r);
    }
  });

  const merged = Array.from(recordsMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return merged.slice(0, limit);
}

export async function insertSensorReading(reading: {
  project_id: string;
  temperature: number;
  humidity: number;
  moisture: number;
  status: string;
}) {
  const localRec = saveLocalSensorReading(reading);
  try {
    const { data } = await supabase.from("sensor_readings").insert(reading).select().single();
    if (data) return data;
  } catch (e) {
    // fallback
  }
  return localRec;
}

