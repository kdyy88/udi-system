/**
 * System-default template definitions — available to all users, read-only.
 * IDs are prefixed "sys-" to distinguish them from user-created DB records.
 *
 * Unit system: internal px (3.7795px/mm).
 * Aspect constraints are respected:
 *   DataMatrix → 1:1  (w === h)
 *   GS1-128    → 6:1  (w === 6h)
 */

import type { CanvasDefinition } from "@/types/template";

export type SystemTemplate = {
  id: string;
  name: string;
  description: string;
  canvas: CanvasDefinition;
};

// ─── Layout 1: 紧凑型（DataMatrix + AI文字，60×30mm）────────────────────────────
const compact: SystemTemplate = {
  id: "sys-compact",
  name: "紧凑型",
  description: "DataMatrix + GS1文字，60×30mm",
  canvas: {
    widthPx: 227,  // 60mm
    heightPx: 113, // 30mm
    elements: [
      // DataMatrix 1:1 — 25mm × 25mm
      { id: "s1-dm", type: "barcode", barcodeType: "datamatrix", x: 8,   y: 9,  w: 96,  h: 96  },
      // AI text fields stacked on right
      { id: "s1-t1", type: "text", x: 112, y: 9,  w: 107, h: 20, content: "", fieldBinding: "01", fontSize: 12, fontWeight: "bold",   textAlign: "left" },
      { id: "s1-t2", type: "text", x: 112, y: 33, w: 107, h: 18, content: "", fieldBinding: "10", fontSize: 11, fontWeight: "normal", textAlign: "left" },
      { id: "s1-t3", type: "text", x: 112, y: 55, w: 107, h: 18, content: "", fieldBinding: "17", fontSize: 11, fontWeight: "normal", textAlign: "left" },
      { id: "s1-t4", type: "text", x: 112, y: 77, w: 107, h: 18, content: "", fieldBinding: "21", fontSize: 11, fontWeight: "normal", textAlign: "left" },
    ],
  },
};

// ─── Layout 2: 标准型（DataMatrix + 五字段，100×45mm）───────────────────────────
const standard: SystemTemplate = {
  id: "sys-standard",
  name: "标准型",
  description: "DataMatrix + 五个AI字段，100×45mm",
  canvas: {
    widthPx: 378,  // 100mm
    heightPx: 170, // 45mm
    elements: [
      // DataMatrix 1:1 — 38mm × 38mm
      { id: "s2-dm", type: "barcode", barcodeType: "datamatrix", x: 8,   y: 13,  w: 144, h: 144 },
      { id: "s2-t1", type: "text", x: 162, y: 13,  w: 208, h: 22, content: "", fieldBinding: "01", fontSize: 14, fontWeight: "bold",   textAlign: "left" },
      { id: "s2-t2", type: "text", x: 162, y: 43,  w: 208, h: 18, content: "", fieldBinding: "10", fontSize: 12, fontWeight: "normal", textAlign: "left" },
      { id: "s2-t3", type: "text", x: 162, y: 67,  w: 208, h: 18, content: "", fieldBinding: "17", fontSize: 12, fontWeight: "normal", textAlign: "left" },
      { id: "s2-t4", type: "text", x: 162, y: 91,  w: 208, h: 18, content: "", fieldBinding: "11", fontSize: 12, fontWeight: "normal", textAlign: "left" },
      { id: "s2-t5", type: "text", x: 162, y: 115, w: 208, h: 18, content: "", fieldBinding: "21", fontSize: 12, fontWeight: "normal", textAlign: "left" },
    ],
  },
};

// ─── Layout 3: 双码型（DataMatrix + GS1-128，100×60mm）──────────────────────────
const dual: SystemTemplate = {
  id: "sys-dual",
  name: "双码型",
  description: "DataMatrix + GS1-128，100×60mm",
  canvas: {
    widthPx: 378,  // 100mm
    heightPx: 227, // 60mm
    elements: [
      // DataMatrix 1:1 — ~40mm × 40mm
      { id: "s3-dm",  type: "barcode", barcodeType: "datamatrix", x: 8,   y: 8,   w: 150, h: 150 },
      // AI text fields to the right of DataMatrix
      { id: "s3-t1",  type: "text",    x: 166, y: 8,   w: 204, h: 22, content: "", fieldBinding: "01", fontSize: 13, fontWeight: "bold",   textAlign: "left" },
      { id: "s3-t2",  type: "text",    x: 166, y: 38,  w: 204, h: 18, content: "", fieldBinding: "10", fontSize: 11, fontWeight: "normal", textAlign: "left" },
      { id: "s3-t3",  type: "text",    x: 166, y: 62,  w: 204, h: 18, content: "", fieldBinding: "17", fontSize: 11, fontWeight: "normal", textAlign: "left" },
      { id: "s3-t4",  type: "text",    x: 166, y: 86,  w: 204, h: 18, content: "", fieldBinding: "11", fontSize: 11, fontWeight: "normal", textAlign: "left" },
      // GS1-128 full-width at bottom — 6:1 ratio: 360px / 60px = 6 ✓
      { id: "s3-128", type: "barcode", barcodeType: "gs1128",    x: 9,   y: 163, w: 360, h: 60  },
    ],
  },
};

export const SYSTEM_TEMPLATES: SystemTemplate[] = [compact, standard, dual];

/**
 * Merge admin-saved canvas overrides on top of the hardcoded defaults.
 * Returns a new array — originals are not mutated.
 */
export function applyOverrides(
  overrides: Record<string, CanvasDefinition>,
): SystemTemplate[] {
  return SYSTEM_TEMPLATES.map((t) => {
    const ov = overrides[t.id];
    return ov ? { ...t, canvas: ov } : t;
  });
}
