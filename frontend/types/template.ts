// ─── GS1 AI Field binding keys ────────────────────────────────────────────────
export type GS1AiField = "01" | "10" | "11" | "17" | "21";

export const GS1_AI_LABELS: Record<GS1AiField, string> = {
  "01": "(01) UDI-DI / GTIN",
  "10": "(10) 批次号",
  "11": "(11) 生产日期",
  "17": "(17) 有效期",
  "21": "(21) 序列号",
};

// ─── Mixed-text segment model ─────────────────────────────────────────────────

/**
 * A TextSegment is one "pill" inside a mixed text element.
 * - kind "literal": raw text the user typed
 * - kind "variable": a GS1 AI field that resolves to live data at print/export time
 */
export type TextSegment =
  | { kind: "literal"; text: string }
  | { kind: "variable"; ai: GS1AiField };

// ─── Canvas Element DSL ───────────────────────────────────────────────────────

export type BarcodeType =
  | "datamatrix"
  | "gs1128"
  | "gs1128_di"
  | "gs1128_pi"
  | "qrcode"
  | "aztec"
  | "ean13"
  | "ean8"
  | "code128";

export type BarcodeElement = {
  type: "barcode";
  id: string;
  x: number;        // px
  y: number;        // px
  w: number;        // px
  h: number;        // px
  barcodeType: BarcodeType;
  /**
   * For non-GS1 barcode types (qrcode, aztec, code128) the user can supply
   * a static text string to encode.  If omitted the HRI string is used.
   */
  customText?: string;
};

export type TextElement = {
  type: "text";
  id: string;
  x: number;        // px
  y: number;        // px
  w: number;        // px
  h: number;        // px
  /** Legacy plain-text content.  Only used when `segments` is absent. */
  content: string;
  /** Legacy single-field binding.  Only used when `segments` is absent. */
  fieldBinding: GS1AiField | null;
  /**
   * Mixed-text segment list (v2 model).
   * When present, `content` and `fieldBinding` are ignored.
   */
  segments?: TextSegment[];
  fontSize: number; // px
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
};

export type RectElement = {
  type: "rect";
  id: string;
  x: number;        // px
  y: number;        // px
  w: number;        // px
  h: number;        // px
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type CanvasElement = BarcodeElement | TextElement | RectElement;

// ─── Canvas layout definition ─────────────────────────────────────────────────

export type CanvasDefinition = {
  widthPx: number;
  heightPx: number;
  elements: CanvasElement[];
};

// ─── API types ────────────────────────────────────────────────────────────────

export type LabelTemplateRecord = {
  id: number;
  owner_id: string;
  name: string;
  description: string | null;
  canvas_width_px: number;
  canvas_height_px: number;
  canvas_json: CanvasElement[];
  created_at: string;
  updated_at: string;
};

export type TemplateListResponse = {
  total: number | null;
  next_cursor: number | null;
  items: LabelTemplateRecord[];
};

// ─── Conversion helpers ───────────────────────────────────────────────────────

/** 1 mm = 3.7795275591 px */
export const MM_TO_PX = 3.7795275591;
export const PX_TO_MM = 1 / MM_TO_PX;

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX * 100) / 100;
}

export function pxToMm(px: number): number {
  return Math.round(px * PX_TO_MM * 10) / 10;
}

export function recordToDefinition(t: LabelTemplateRecord): CanvasDefinition {
  return {
    widthPx: t.canvas_width_px,
    heightPx: t.canvas_height_px,
    elements: t.canvas_json,
  };
}
