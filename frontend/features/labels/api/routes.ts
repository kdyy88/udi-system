export const LABELS_API_ROUTES = {
  generate: "/api/v1/labels/generate",
  preview: "/api/v1/labels/preview",
  previewSvg: "/api/v1/labels/preview-svg",
  history: "/api/v1/labels/history",
  historyDetail: (id: number) => `/api/v1/labels/history/${id}`,
  historyById: (id: number) => `/api/v1/labels/history/${id}`,
} as const;

export const BATCHES_API_ROUTES = {
  batchGenerate: "/api/v1/batches/generate",
  batches: "/api/v1/batches",
  batchById: (id: number) => `/api/v1/batches/${id}`,
} as const;

