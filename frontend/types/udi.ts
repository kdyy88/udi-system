export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export type AuthUser = {
  user_id: number;
  username: string;
};

export type LoginResponse = {
  user_id: number;
  username: string;
  message: string;
};

/**
 * Response from POST /api/v1/labels/generate (save-on-export)
 * Barcode images are NOT stored; barcodes are rendered client-side via bwip-js.
 */
export type LabelSaveResponse = {
  history_id: number;
  created_at: string;
  di: string;
  hri: string;
  gs1_element_string: string;
  gs1_element_string_escaped: string;
};

/**
 * Local preview computed from form data — no backend call needed.
 * Holds both the computed GS1 strings and the raw form fields required to
 * save the record when the user exports.
 */
export type LocalPreviewData = {
  di: string;
  hri: string;
  gs1_element_string: string;
  gs1_element_string_escaped: string;
  lot: string | null;
  expiry: string | null;
  serial: string | null;
  productionDate: string | null;
  remarks: string | null;
};

/** Discriminated-union to distinguish a brand-new (unsaved) preview from a history review. */
export type PreviewSource =
  | { kind: "local"; data: LocalPreviewData }
  | { kind: "history"; data: LabelHistoryItem };

export type LabelHistoryItem = {
  id: number;
  user_id: number;
  gtin: string;
  batch_no: string | null;
  expiry_date: string | null;
  serial_no: string | null;
  production_date: string | null;
  remarks: string | null;
  full_string: string;
  hri: string;
  created_at: string;
};

export type LabelHistoryListResponse = {
  total: number;
  next_cursor: number | null;
  items: LabelHistoryItem[];
};

