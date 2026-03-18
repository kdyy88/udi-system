import { create } from "zustand";
import { temporal } from "zundo";

import type {
  CanvasElement,
  BarcodeElement,
  TextElement,
  RectElement,
  CanvasDefinition,
  BarcodeType,
  GS1AiField,
  TextSegment,
} from "@/types/template";

type CanvasElementPatch = {
  type?: CanvasElement["type"];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  barcodeType?: BarcodeType;
  customText?: string;
  content?: string;
  fieldBinding?: GS1AiField | null;
  segments?: TextSegment[];
  fontSize?: number;
  fontWeight?: TextElement["fontWeight"];
  textAlign?: TextElement["textAlign"];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};
type CanvasElementInput = Omit<BarcodeElement, "id"> | Omit<TextElement, "id"> | Omit<RectElement, "id">;

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
  addElement: (el: CanvasElementInput) => void;
  updateElement: (id: string, patch: CanvasElementPatch) => void;
  deleteElement: (id: string) => void;
  deleteElements: (ids: string[]) => void;
  setSelected: (id: string | null) => void;
  toggleSelected: (id: string) => void;
  setCanvasSize: (widthPx: number, heightPx: number) => void;
  toggleSnap: () => void;
  setGridPx: (px: number) => void;
  loadCanvas: (def: CanvasDefinition) => void;
  resetCanvas: () => void;
  canvasDef: () => CanvasDefinition;
};

type CanvasStore = CanvasState & CanvasActions;

const DEFAULT_WIDTH  = 378; // ~100mm
const DEFAULT_HEIGHT = 227; // ~60mm
export const MM_TO_PX_RATIO = 3.7795275591; // 1 mm in px

function withElementId(element: CanvasElementInput, id: string): CanvasElement {
  switch (element.type) {
    case "barcode":
      return { ...element, id };
    case "text":
      return { ...element, id };
    case "rect":
      return { ...element, id };
  }
}

function isBarcodeType(value: unknown): value is BarcodeType {
  return (
    value === "datamatrix" ||
    value === "gs1128" ||
    value === "gs1128_di" ||
    value === "gs1128_pi" ||
    value === "qrcode" ||
    value === "aztec" ||
    value === "ean13" ||
    value === "ean8" ||
    value === "code128"
  );
}

function isGs1AiField(value: unknown): value is GS1AiField {
  return value === "01" || value === "10" || value === "11" || value === "17" || value === "21";
}

function isFontWeight(value: unknown): value is TextElement["fontWeight"] {
  return value === "normal" || value === "bold";
}

function isTextAlign(value: unknown): value is TextElement["textAlign"] {
  return value === "left" || value === "center" || value === "right";
}

function mergeElement(element: CanvasElement, patch: CanvasElementPatch): CanvasElement {
  if (patch.type && patch.type !== element.type) {
    return element;
  }

  switch (element.type) {
    case "barcode":
      return {
        ...element,
        x: patch.x ?? element.x,
        y: patch.y ?? element.y,
        w: patch.w ?? element.w,
        h: patch.h ?? element.h,
        barcodeType: isBarcodeType(patch.barcodeType) ? patch.barcodeType : element.barcodeType,
        customText: "customText" in patch ? patch.customText : element.customText,
      };
    case "text":
      return {
        ...element,
        x: patch.x ?? element.x,
        y: patch.y ?? element.y,
        w: patch.w ?? element.w,
        h: patch.h ?? element.h,
        content: "content" in patch && typeof patch.content === "string" ? patch.content : element.content,
        fieldBinding: patch.fieldBinding === null
          ? null
          : isGs1AiField(patch.fieldBinding)
            ? patch.fieldBinding
            : element.fieldBinding,
        segments: "segments" in patch ? patch.segments : element.segments,
        fontSize: "fontSize" in patch && typeof patch.fontSize === "number" ? patch.fontSize : element.fontSize,
        fontWeight: isFontWeight(patch.fontWeight) ? patch.fontWeight : element.fontWeight,
        textAlign: isTextAlign(patch.textAlign) ? patch.textAlign : element.textAlign,
      };
    case "rect":
      return {
        ...element,
        x: patch.x ?? element.x,
        y: patch.y ?? element.y,
        w: patch.w ?? element.w,
        h: patch.h ?? element.h,
        fill: "fill" in patch && typeof patch.fill === "string" ? patch.fill : element.fill,
        stroke: "stroke" in patch && typeof patch.stroke === "string" ? patch.stroke : element.stroke,
        strokeWidth: "strokeWidth" in patch && typeof patch.strokeWidth === "number"
          ? patch.strokeWidth
          : element.strokeWidth,
      };
  }
}

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

export function snapToGrid(value: number, gridPx: number): number {
  return Math.round(value / gridPx) * gridPx;
}

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    (set, get) => ({
      widthPx: DEFAULT_WIDTH,
      heightPx: DEFAULT_HEIGHT,
      elements: [],
      selectedIds: [],
      snapEnabled: false,
      gridPx: Math.round(MM_TO_PX_RATIO * 2), // 2 mm default grid

      addElement: (el) =>
        set((s) => ({ elements: [...s.elements, withElementId(el, generateElementId())] })),

      updateElement: (id, patch) =>
        set((s) => ({
          elements: s.elements.map((el) =>
            el.id === id ? mergeElement(el, patch) : el,
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
      partialize: (s) => ({
        elements: s.elements,
        widthPx: s.widthPx,
        heightPx: s.heightPx,
      }),
      limit: 50,
    },
  ),
);

export const GS1_128_ASPECT_RATIO = 6;  // width / height (linear barcodes are wide)
export const DATAMATRIX_ASPECT_RATIO = 1; // 1:1 square
export const QR_ASPECT_RATIO = 1;         // 1:1 square
export const AZTEC_ASPECT_RATIO = 1;      // 1:1 square
export const EAN13_ASPECT_RATIO = 1.5;   // ~68:45 ≈ 1.5:1
export const EAN8_ASPECT_RATIO  = 1.2;   // narrow EAN-8
export const CODE128_ASPECT_RATIO = 4;   // linear, wide

export function barcodeAspectRatio(barcodeType: BarcodeType): number | false {
  if (isGs1128Type(barcodeType))  return GS1_128_ASPECT_RATIO;
  if (barcodeType === "datamatrix") return DATAMATRIX_ASPECT_RATIO;
  if (barcodeType === "qrcode")    return QR_ASPECT_RATIO;
  if (barcodeType === "aztec")     return AZTEC_ASPECT_RATIO;
  if (barcodeType === "ean13")     return EAN13_ASPECT_RATIO;
  if (barcodeType === "ean8")      return EAN8_ASPECT_RATIO;
  if (barcodeType === "code128")   return CODE128_ASPECT_RATIO;
  return false;
}

export function isGs1128Type(barcodeType: BarcodeType): boolean {
  return barcodeType === "gs1128" || barcodeType === "gs1128_di" || barcodeType === "gs1128_pi";
}

/** True for non-GS1 barcode types that accept free-form customText. */
export function isCustomTextType(barcodeType: BarcodeType): boolean {
  return barcodeType === "qrcode" || barcodeType === "aztec" || barcodeType === "code128";
}

export function makeBarcode(barcodeType: BarcodeType = "datamatrix"): Omit<BarcodeElement, "id"> {
  if (isGs1128Type(barcodeType)) {
    return { type: "barcode", x: 10, y: 10, w: 240, h: 40, barcodeType };
  }
  if (barcodeType === "ean13") {
    return { type: "barcode", x: 10, y: 10, w: 120, h: 80, barcodeType };
  }
  if (barcodeType === "ean8") {
    return { type: "barcode", x: 10, y: 10, w: 90, h: 75, barcodeType };
  }
  if (barcodeType === "code128") {
    return { type: "barcode", x: 10, y: 10, w: 200, h: 50, barcodeType };
  }
  // square types (datamatrix, qrcode, aztec)
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
