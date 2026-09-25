export interface TrainedModel {
  id: string;
  name: string;
  architecture: string;
  version: string;
  datasetName: string;
  metrics: {
    mAP50: number;
    precision: number;
    recall: number;
  };
  isActive: boolean;
  createdAt: string;
}

const STORAGE_KEY = "smart_estimator_ai_models_v1";

const DEFAULT_MODELS: TrainedModel[] = [
  {
    id: "yolov8-blueprint-v2",
    name: "YOLOv8-x CAD Blueprint Net",
    architecture: "YOLOv8-x (Custom CAD Anchor Head)",
    version: "2.4.0",
    datasetName: "Combined Construction Blueprint Dataset v4",
    metrics: {
      mAP50: 94.8,
      precision: 93.2,
      recall: 95.1,
    },
    isActive: true,
    createdAt: "2026-08-15T10:00:00.000Z",
  },
  {
    id: "resnet-structural-v1",
    name: "ResNet-101 Structural & MEP",
    architecture: "ResNet-101 + Feature Pyramid Network",
    version: "1.8.0",
    datasetName: "Civil & Electrical Schematics Dataset",
    metrics: {
      mAP50: 91.5,
      precision: 89.7,
      recall: 92.4,
    },
    isActive: false,
    createdAt: "2026-07-20T10:00:00.000Z",
  },
];

export function getStoredModels(): TrainedModel[] {
  if (typeof window === "undefined") return DEFAULT_MODELS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MODELS));
      return DEFAULT_MODELS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_MODELS;
  }
}

export function getActiveModel(): TrainedModel {
  const models = getStoredModels();
  return models.find((m) => m.isActive) || models[0] || DEFAULT_MODELS[0];
}

export function setActiveModel(id: string): TrainedModel {
  const models = getStoredModels();
  const updated = models.map((m) => ({
    ...m,
    isActive: m.id === id,
  }));
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated.find((m) => m.isActive) || DEFAULT_MODELS[0];
}
