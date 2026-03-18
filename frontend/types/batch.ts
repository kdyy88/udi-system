import type { LabelHistoryItem } from "@/types/udi";
import type { CanvasDefinition } from "@/types/template";

/**
 * v3.5: BatchTemplate is now a CanvasDefinition (custom, DB-persisted).
 * The "compact" / "dual" / "detail" string keys are deprecated.
 */
export type BatchTemplate = CanvasDefinition;

export type BatchSource = "excel" | "form";

export type LabelBatchSummary = {
  id: number;
  owner_id: string;
  name: string;
  source: BatchSource;
  total_count: number;
  created_at: string;
  template_definition: CanvasDefinition | null;
};

export type BatchCreateResponse = {
  batch_id: number;
  name: string;
  source: BatchSource;
  total_count: number;
  created_at: string;
};

export type LabelBatchListResponse = {
  total: number | null;
  next_cursor: number | null;
  items: LabelBatchSummary[];
};

export type LabelBatchDetailResponse = LabelBatchSummary & {
  next_cursor: number | null;
  labels: LabelHistoryItem[];
};

// ─── Local types used by the batch upload state machine ──────────────────────

export type ParsedRow = {
  /** 0-based row index in the Excel sheet */
  rowIndex: number;
  di: string;
  lot: string | null;
  expiry: string | null;
  serial: string | null;
  production_date: string | null;
  remarks: string | null;
  /** Validation error message if we already know this row will be rejected. */
  validationError: string | null;
};

export type BatchPhase =
  | "idle"
  | "parsing"
  | "validated"
  | "saving"
  | "generating"
  | "done"
  | "error";

export type GenerateProgress = {
  current: number;
  total: number;
};
