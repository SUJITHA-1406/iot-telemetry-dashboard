export type BuildingType = "Residential" | "Commercial" | "Industrial";

export type FloorDetections = {
  floor: number;
  floorName: string;
  civil: Record<string, number>;
  electrical: Record<string, number>;
  mechanical: Record<string, number>;
  confidence: { civil: number; electrical: number; mechanical: number };
};

export type Detections = {
  civil: Record<string, number>;
  electrical: Record<string, number>;
  mechanical: Record<string, number>;
  confidence: { civil: number; electrical: number; mechanical: number };
  floors?: FloorDetections[];
};

export type ProjectLike = {
  area: number;
  floors: number;
  building_type: string;
};

const typeFactor: Record<string, number> = {
  Residential: 1,
  Commercial: 1.18,
  Industrial: 1.32,
};

/**
 * Simulated blueprint detection. Deterministic per project so results are
 * stable across visits. Replaceable by real YOLOv8 output with the same shape.
 */
export function simulateDetections(project: ProjectLike): Detections {
  const area = Math.max(200, Number(project.area) || 1000);
  const floors = Math.max(1, Number(project.floors) || 1);
  const f = typeFactor[project.building_type] ?? 1;
  const n = (x: number) => Math.max(1, Math.round(x));

  if (floors > 1) {
    const floorsList: FloorDetections[] = [];
    for (let i = 1; i <= floors; i++) {
      const civilFactor = i === 1 ? 1.05 : i === 2 ? 0.85 : i === 3 ? 0.95 : 0.8;
      const elecFactor = i === 1 ? 1.0 : i === 2 ? 1.12 : i === 3 ? 0.9 : 0.85;
      const mechFactor = i === 1 ? 1.15 : i === 2 ? 0.82 : i === 3 ? 1.0 : 0.75;

      floorsList.push({
        floor: i,
        floorName: i === 1 ? "Ground Floor" : i === 2 ? "1st Floor" : i === 3 ? "2nd Floor" : `${i - 1}th Floor`,
        civil: {
          Walls: n((area / 145) * f * civilFactor),
          Doors: n((area / 520) * f * civilFactor),
          Windows: n((area / 380) * f * civilFactor),
          Columns: n((area / 420) * f),
          Beams: n((area / 340) * f),
          Staircase: i < floors ? 1 : 0,
          Roof: i === floors ? 1 : 0,
        },
        electrical: {
          Switches: n((area / 180) * f * elecFactor),
          Sockets: n((area / 150) * f * elecFactor),
          Lights: n((area / 120) * f * elecFactor),
          "Distribution Board": 1,
          "Electrical Wiring": n((area / 40) * f * elecFactor),
        },
        mechanical: {
          "Water Pipes": n((area / 90) * f * mechFactor),
          "Drain Pipes": n((area / 130) * f * mechFactor),
          HVAC: n((area / 900) * f * mechFactor),
          Ventilation: n((area / 600) * f * mechFactor),
          "Fire Safety Lines": n((area / 800) * f * mechFactor),
        },
        confidence: {
          civil: Number((93.5 + (i % 3) * 0.5).toFixed(1)),
          electrical: Number((90.2 + (i % 2) * 0.8).toFixed(1)),
          mechanical: Number((88.1 + (i % 4) * 0.3).toFixed(1)),
        },
      });
    }

    const civil: Record<string, number> = {};
    const electrical: Record<string, number> = {};
    const mechanical: Record<string, number> = {};

    for (const fl of floorsList) {
      for (const [k, v] of Object.entries(fl.civil)) {
        civil[k] = (civil[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(fl.electrical)) {
        electrical[k] = (electrical[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(fl.mechanical)) {
        mechanical[k] = (mechanical[k] ?? 0) + v;
      }
    }

    const confCivil = Number((floorsList.reduce((sum, fl) => sum + fl.confidence.civil, 0) / floors).toFixed(1));
    const confElec = Number((floorsList.reduce((sum, fl) => sum + fl.confidence.electrical, 0) / floors).toFixed(1));
    const confMech = Number((floorsList.reduce((sum, fl) => sum + fl.confidence.mechanical, 0) / floors).toFixed(1));

    return {
      civil,
      electrical,
      mechanical,
      confidence: {
        civil: confCivil,
        electrical: confElec,
        mechanical: confMech,
      },
      floors: floorsList,
    };
  }

  const u = area * floors;
  return {
    civil: {
      Walls: n((u / 145) * f),
      Doors: n((u / 520) * f),
      Windows: n((u / 380) * f),
      Columns: n((u / 420) * f),
      Beams: n((u / 340) * f),
      Staircase: n(floors > 1 ? floors - 1 + 1 : 1),
      Roof: n(floors),
    },
    electrical: {
      Switches: n((u / 180) * f),
      Sockets: n((u / 150) * f),
      Lights: n((u / 120) * f),
      "Distribution Board": n(floors * f),
      "Electrical Wiring": n((u / 40) * f),
    },
    mechanical: {
      "Water Pipes": n((u / 90) * f),
      "Drain Pipes": n((u / 130) * f),
      HVAC: n((u / 900) * f),
      Ventilation: n((u / 600) * f),
      "Fire Safety Lines": n((u / 800) * f),
    },
    confidence: {
      civil: 94.6,
      electrical: 91.8,
      mechanical: 89.4,
    },
  };
}

export function overallConfidence(d: Detections): number {
  const c = d.confidence;
  return Number(((c.civil + c.electrical + c.mechanical) / 3).toFixed(1));
}

export type MaterialKey =
  | "Cement"
  | "Steel"
  | "Bricks"
  | "Sand"
  | "Concrete"
  | "Paint"
  | "Wire"
  | "PVC Pipe";

export type FloorQuantities = {
  floor: number;
  floorName: string;
  quantities: Record<MaterialKey, number>;
};

export type Quantities = Record<MaterialKey, number> & {
  floors?: FloorQuantities[];
};

export const materialUnits: Record<MaterialKey, string> = {
  Cement: "Bags",
  Steel: "Kg",
  Bricks: "Pieces",
  Sand: "Cu.ft",
  Concrete: "Cu.m",
  Paint: "Litres",
  Wire: "Metres",
  "PVC Pipe": "Metres",
};

/**
 * Quantity take-off derived from detected components + project geometry.
 * Wall area -> bricks -> cement/sand, etc.
 */
export function computeQuantities(project: ProjectLike, d: Detections): Quantities {
  if (d.floors && d.floors.length > 0) {
    const combinedQuantities = {
      Cement: 0,
      Steel: 0,
      Bricks: 0,
      Sand: 0,
      Concrete: 0,
      Paint: 0,
      Wire: 0,
      "PVC Pipe": 0,
    } as Quantities;

    const floorQuantities: FloorQuantities[] = d.floors.map((fl) => {
      const qty = computeQuantities(
        { area: project.area, floors: 1, building_type: project.building_type },
        fl as unknown as Detections
      );
      return {
        floor: fl.floor,
        floorName: fl.floorName,
        quantities: qty,
      };
    });

    for (const fq of floorQuantities) {
      for (const key of materialOrder) {
        combinedQuantities[key] = (combinedQuantities[key] || 0) + fq.quantities[key];
      }
    }

    combinedQuantities.floors = floorQuantities;
    return combinedQuantities;
  }

  const area = Math.max(200, Number(project.area) || 1000);
  const floors = Math.max(1, Number(project.floors) || 1);
  const builtUp = area * floors;
  const wallArea = (d.civil.Walls || 0) * 100; // avg 100 sq.ft per detected wall panel
  const openings = (d.civil.Doors || 0) * 21 + (d.civil.Windows || 0) * 15;
  const netWall = Math.max(wallArea - openings, wallArea * 0.75);

  const bricks = Math.round(netWall * 8.6);
  const concrete = Number((((d.civil.Columns || 0) * 0.42 + (d.civil.Beams || 0) * 0.31 + builtUp * 0.0042)).toFixed(2));
  const cement = Math.round(bricks / 105 + concrete * 8.2 + netWall * 0.021);
  const sand = Math.round(bricks / 60 + concrete * 15.5);
  const steel = Math.round(concrete * 92 + builtUp * 1.05);
  const paint = Math.round((netWall * 2.1) / 110);
  const wire = Math.round((d.electrical["Electrical Wiring"] || 0) * 12 + builtUp * 0.35);
  const pipe = Math.round((d.mechanical["Water Pipes"] || 0) * 5 + (d.mechanical["Drain Pipes"] || 0) * 6);

  return {
    Cement: cement,
    Steel: steel,
    Bricks: bricks,
    Sand: sand,
    Concrete: concrete,
    Paint: paint,
    Wire: wire,
    "PVC Pipe": pipe,
  };
}

export type FloorCostBreakdown = {
  floor: number;
  floorName: string;
  breakdown: {
    materialCost: number;
    labor: number;
    equipment: number;
    transportation: number;
    gst: number;
    contingency: number;
    total: number;
  };
};

export type CostBreakdown = {
  materialCost: number;
  labor: number;
  equipment: number;
  transportation: number;
  gst: number;
  contingency: number;
  total: number;
  floors?: FloorCostBreakdown[];
};

export function computeCostBreakdown(materialCost: number): CostBreakdown {
  const labor = materialCost * 0.28;
  const equipment = materialCost * 0.09;
  const transportation = materialCost * 0.05;
  const subtotal = materialCost + labor + equipment + transportation;
  const gst = subtotal * 0.18;
  const contingency = subtotal * 0.05;
  return {
    materialCost: round(materialCost),
    labor: round(labor),
    equipment: round(equipment),
    transportation: round(transportation),
    gst: round(gst),
    contingency: round(contingency),
    total: round(subtotal + gst + contingency),
  };
}

function round(n: number) {
  return Math.round(n);
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

export const materialOrder: MaterialKey[] = [
  "Cement",
  "Steel",
  "Bricks",
  "Sand",
  "Concrete",
  "Paint",
  "Wire",
  "PVC Pipe",
];

export function getStatusProgress(status: string): number {
  switch (status) {
    case "Completed":
      return 100;
    case "Project Completion":
      return 90;
    case "Finishing":
      return 65;
    case "Electrical & Plumbing":
      return 45;
    case "Structural Work":
      return 20;
    case "Foundation Work":
      return 10; // 10% represent some foundation progress started/completed
    default:
      return 0;
  }
}

export function estimateConstructionDuration(project: {
  area?: number;
  floors?: number;
  building_type?: string;
  foundation?: string;
  roof?: string;
} | null | undefined): number {
  if (!project) return 5; // Base default is 5 months
  
  let duration = 5;

  // 1. Scale by Built-up Area
  const area = Number(project.area) || 1000;
  if (area >= 1000 && area < 2500) {
    duration += 1;
  } else if (area >= 2500 && area < 5000) {
    duration += 2;
  } else if (area >= 5000) {
    duration += 3 + Math.floor((area - 5000) / 2500);
  }

  // 2. Scale by Number of Floors
  const floors = Number(project.floors) || 1;
  if (floors === 2) {
    duration += 1;
  } else if (floors >= 3 && floors <= 4) {
    duration += 2;
  } else if (floors >= 5) {
    duration += 3 + (floors - 5);
  }

  // 3. Scale by Building Type complexity
  if (project.building_type === "Commercial") {
    duration += 1;
  } else if (project.building_type === "Industrial") {
    duration += 2;
  }

  // 4. Scale by Foundation Type complexity
  if (project.foundation === "Pile Foundation") {
    duration += 2;
  } else if (project.foundation === "Raft Foundation") {
    duration += 1;
  }

  // 5. Scale by Roof Type complexity
  if (project.roof === "Shell Roof") {
    duration += 2;
  } else if (project.roof === "RCC Flat Slab") {
    duration += 1;
  }

  // Cap duration between 3 months and 24 months
  return Math.min(24, Math.max(3, duration));
}


