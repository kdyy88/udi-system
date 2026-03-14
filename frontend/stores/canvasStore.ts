/**
 * Zustand canvas editor store with zundo undo/redo middleware.
 *
 * All coordinates and sizes are in px (internal unit).
 * The CSS transform:scale(zoom) in Canvas.tsx handles display scaling without
 * touching this state — no unit math in drag callbacks.
 */
import { create } from "zustand";
import { temporal } from "zundo";

import type { CanvasElement, BarcodeElement, TextElement, RectElement, CanvasDefinition, BarcodeType } from "@/types/template";

// ─── Store shape ──────────────────────────────────────────────────────────────

type CanvasState = {
  // Canvas dimensions (px)
  widthPx: number;
  heightPx: number;
  // Element DSL
  elements: CanvasElement[];
  // Selection — supports multi-select via Shift+click
  selectedIds: string[];
  // Grid / snap
  snapEnabled: boolean;
  gridPx: number; // px per grid cell; 1 mm ≈ 3.78 px
};

type CanvasActions = {
  // Element CRUD
  addElement: (el: Omit<CanvasElement, "id">) => void;
  updateElement: (id: string, patch: Record<string, unknown>) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  // Selection
  setSelected: (id: string | null) => void;   // null = clear; string = single select
  toggleSelected: (id: string) => void;        // Shift+click: add/remove from set
  // Canvas size
  setCanvasSize: (widthPx: number, heightPx: number) => void;
  // Grid / snap
  toggleSnap: () => void;
  setGridPx: (px: number) => void;
  // Load a full CanvasDefinition (e.g. from DB)
  loadCanvas: (def: CanvasDefinition) => void;
  // Clear canvas
  resetCanvas: () => void;
  // Read-only derived view
  canvasDef: () => CanvasDefinition;
};

type CanvasStore = CanvasState & CanvasActions;

// ─── Default dimensions ── 100mm × 60mm at 3.7795px/mm ───────────────────────
const DEFAULT_WIDTH  = 378; // ~100mm
const DEFAULT_HEIGHT = 227; // ~60mm
export const MM_TO_PX_RATIO = 3.7795275591; // 1 mm in px

function generateElementId(): string {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }
    if (cryptoApi?.getRandomValues) {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }

  return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Snap a raw px value to the nearest grid multiple. */
export function snapToGrid(value: number, gridPx: number): number {
  return Math.round(value / gridPx) * gridPx;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    (set, get) => ({
      // State
      widthPx: DEFAULT_WIDTH,
      heightPx: DEFAULT_HEIGHT,
      elements: [],
      selectedIds: [],
      snapEnabled: false,
      gridPx: Math.round(MM_TO_PX_RATIO * 2), // 2 mm default grid

      // Actions
      addElement: (el) =>
        set((s) => ({ elements: [...s.elements, { ...el, id: generateElementId() } as CanvasElement] })),

      updateElement: (id, patch) =>
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? ({ ...el, ...patch } as CanvasElement) : el,
          ),
        })),

      deleteElement: (id) =>
        set((s) => ({
          elements: s.elements.filter((el) => el.id !== id),
          selectedIds: s.selectedIds.filter((i) => i !== id),
        })),

      deleteElements: (ids) =>
        set((s) => ({
          elements: s.elements.filter((el) => !ids.includes(el.id)),
          selectedIds: s.selectedIds.filter((i) => !ids.includes(i)),
        })),

      setSelected: (id) => set({ selectedIds: id === null ? [] : [id] }),

      toggleSelected: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((i) => i !== id)
            : [...s.selectedIds, id],
        })),

      setCanvasSize: (widthPx, heightPx) => set({ widthPx, heightPx }),

      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

      setGridPx: (px) => set({ gridPx: px }),

      loadCanvas: (def) =>
        set({
          widthPx: def.widthPx,
          heightPx: def.heightPx,
          elements: def.elements,
          selectedIds: [],
        }),

      resetCanvas: () =>
        set({ elements: [], selectedIds: [], widthPx: DEFAULT_WIDTH, heightPx: DEFAULT_HEIGHT }),

      canvasDef: () => {
        const { widthPx, heightPx, elements } = get();
        return { widthPx, heightPx, elements };
      },
    }),
    {
      // Only track element changes in undo history (not selection)
      partialize: (s) => ({
        elements: s.elements,
        widthPx: s.widthPx,
        heightPx: s.heightPx,
      }),
      limit: 50,
    },
  ),
);

// ─── Convenience factory helpers ──────────────────────────────────────────────

/** Width-to-height aspect ratio for GS1-128 linear barcode elements (wide/short). */
export const GS1_128_ASPECT_RATIO = 6; // width / height

/** Width-to-height aspect ratio for DataMatrix barcode elements (square). */
export const DATAMATRIX_ASPECT_RATIO = 1; // width / height = 1:1

/** Returns the required aspect ratio for a barcode type, or false if unconstrained. */
export function barcodeAspectRatio(barcodeType: BarcodeType): number | false {
  if (isGs1128Type(barcodeType)) return GS1_128_ASPECT_RATIO;
  if (barcodeType === "datamatrix") return DATAMATRIX_ASPECT_RATIO;
  return false;
}

/** Barcode types that are GS1-128 (linear, wide). */
export function isGs1128Type(barcodeType: BarcodeType): boolean {
  return barcodeType === "gs1128" || barcodeType === "gs1128_di" || barcodeType === "gs1128_pi";
}

export function makeBarcode(barcodeType: BarcodeType = "datamatrix"): Omit<BarcodeElement, "id"> {
  if (isGs1128Type(barcodeType)) {
    return { type: "barcode", x: 10, y: 10, w: 240, h: 40, barcodeType };
  }
  // DataMatrix — square 1:1
  return { type: "barcode", x: 10, y: 10, w: 100, h: 100, barcodeType };
}

export function makeText(): Omit<TextElement, "id"> {
  return {
    type: "text",
    x: 120,
    y: 20,
    w: 200,
    h: 30,
    content: "文本",
    fieldBinding: null,
    fontSize: 16,
    fontWeight: "normal",
    textAlign: "left",
  };
}

export function makeRect(): Omit<RectElement, "id"> {
  return { type: "rect", x: 10, y: 10, w: 150, h: 80, fill: "none", stroke: "#000000", strokeWidth: 1 };
}
