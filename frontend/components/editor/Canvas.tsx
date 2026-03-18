"use client";

/**
 * Canvas.tsx — react-rnd drag/resize whiteboard.
 *
 * Key design decisions:
 * - Store coordinates are "design units" (small numbers, e.g. 227×113 for 60×30 mm).
 * - `displayScale` multiplies every position/size directly into DOM pixels.
 *   NO CSS transform:scale is used — so selection outlines, resize handles and
 *   grid lines are always exactly 1 physical pixel regardless of zoom level.
 * - On dragStop / resizeStop the DOM values are divided back by displayScale
 *   before being written to the store, keeping store coords scale-independent.
 * - BarcodeElements render as placeholder divs — bwip-js is never called here.
 *
 * Level 1 — Keyboard nudging (operates in design units):
 *   Arrow keys  → ±1 design px
 *   Shift+Arrow → ±10 design px
 *   Delete/Backspace → delete selected elements
 *
 * Level 2 — Grid / Snap (grid cell = gridPx design units × displayScale).
 */

import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import Selecto from "react-selecto";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore, barcodeAspectRatio } from "@/stores/canvasStore";
import { getSegments, segmentsPreview } from "@/lib/segmentEngine";
import type { CanvasElement } from "@/types/template";

const MIN_DESIGN_PX = 4; // minimum element size in design units

/** Step for plain Arrow nudge (design px). */
const NUDGE_SMALL = 1;
/** Step for Shift+Arrow nudge (design px). */
const NUDGE_BIG = 10;

// ─── Individual draggable/resizable element ───────────────────────────────────

function RndElement({
  id,
  ds,       // displayScale
  gridPx,
  snapEnabled,
  selectoRef,
}: {
  id: string;
  ds: number;
  gridPx: number;
  snapEnabled: boolean;
  selectoRef: React.RefObject<Selecto | null>;
}) {
  const el           = useCanvasStore((s) => s.elements.find((e) => e.id === id));
  const isSelected   = useCanvasStore((s) => s.selectedIds.includes(id));
  const setSelected  = useCanvasStore((s) => s.setSelected);
  const toggleSelected = useCanvasStore((s) => s.toggleSelected);
  const updateElement  = useCanvasStore((s) => s.updateElement);
  if (!el) return null;

  const aspectLock = el.type === "barcode" ? barcodeAspectRatio(el.barcodeType) : false;
  // Snap grid in display pixels
  const snapPx: [number, number] = snapEnabled
    ? [Math.round(gridPx * ds), Math.round(gridPx * ds)]
    : [1, 1];

  return (
    <Rnd
      // Positions/sizes in DOM pixels = design value × displayScale
      size={{ width: el.w * ds, height: el.h * ds }}
      position={{ x: el.x * ds, y: el.y * ds }}
      bounds="parent"
      // No scale prop — we're not using CSS transform, so no correction needed
      minWidth={MIN_DESIGN_PX * ds}
      minHeight={MIN_DESIGN_PX * ds}
      lockAspectRatio={aspectLock}
      dragGrid={snapPx}
      resizeGrid={snapPx}
      className="rnd-el"
      data-el-id={id}
      onMouseDown={(e) => {
        if ((e as MouseEvent).shiftKey) toggleSelected(id);
        else setSelected(id);
      }}
      onDragStop={(_e, d) => {
        // Convert DOM pixels back to design units
        updateElement(id, {
          x: Math.round(d.x / ds),
          y: Math.round(d.y / ds),
        });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        updateElement(id, {
          w: Math.round(ref.offsetWidth  / ds),
          h: Math.round(ref.offsetHeight / ds),
          x: Math.round(pos.x / ds),
          y: Math.round(pos.y / ds),
        });
      }}
      style={{
        // Always 1px outline — never scaled, always crisp
        outline: isSelected ? "1px solid #3b82f6" : "none",
        outlineOffset: "1px",
        cursor: "move",
        userSelect: "none",
      }}
    >
      <ElementContent el={el} ds={ds} />
    </Rnd>
  );
}

function ElementContent({ el, ds }: { el: CanvasElement; ds: number }) {
  if (el.type === "barcode") {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-400 bg-gray-100 text-gray-500 select-none pointer-events-none"
        style={{ fontSize: Math.max(10, 11 * ds) }}
      >
        {barcodeLabelMap[el.barcodeType] ?? el.barcodeType}
      </div>
    );
  }

  if (el.type === "text") {
    const segments = getSegments(el);
    const preview  = segmentsPreview(segments);
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden pointer-events-none"
        style={{
          // Scale font size with displayScale so text looks proportional on screen
          fontSize:   el.fontSize * ds,
          fontWeight: el.fontWeight,
          justifyContent:
            el.textAlign === "center" ? "center"
            : el.textAlign === "right"  ? "flex-end"
            : "flex-start",
          color:      "#111",
          fontFamily: "sans-serif",
        }}
      >
        <span className="truncate">
          {preview || <span className="text-gray-400 italic">（空文本）</span>}
        </span>
      </div>
    );
  }

  if (el.type === "rect") {
    return (
      <div
        className="h-full w-full pointer-events-none"
        style={{
          background:  el.fill === "none" ? "transparent" : el.fill,
          // Scale stroke width with ds so it looks proportional
          border:      `${el.strokeWidth * ds}px solid ${el.stroke}`,
          boxSizing:   "border-box",
        }}
      />
    );
  }

  return null;
}

const barcodeLabelMap: Record<string, string> = {
  datamatrix: "▦ DataMatrix",
  gs1128:     "▬ GS1-128",
  gs1128_di:  "▬ GS1-128 DI",
  gs1128_pi:  "▬ GS1-128 PI",
  qrcode:     "⊞ QR Code",
  aztec:      "⊡ Aztec",
  ean13:      "▌ EAN-13",
  ean8:       "▌ EAN-8",
  code128:    "▬ Code 128",
};

// ─── Canvas container ─────────────────────────────────────────────────────────

/**
 * @param displayScale  Multiplier applied to all design-unit coordinates before
 *                      writing them to the DOM.  Default 3 gives comfortable
 *                      editing of small labels without any CSS transform.
 *                      Selection outlines stay 1 physical px at any scale.
 */
export function Canvas({ displayScale = 3 }: { displayScale?: number }) {
  const widthPx    = useCanvasStore((s) => s.widthPx);
  const heightPx   = useCanvasStore((s) => s.heightPx);
  const elementIds = useCanvasStore(useShallow((s) => s.elements.map((e) => e.id)));
  const setSelected = useCanvasStore((s) => s.setSelected);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const gridPx     = useCanvasStore((s) => s.gridPx);

  const containerRef = useRef<HTMLDivElement>(null);
  const selectoRef   = useRef<Selecto>(null);
  const [outerEl, setOuterEl] = useState<HTMLDivElement | null>(null);

  // ── Keyboard nudging (design-unit steps) ─────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const { selectedIds, elements, updateElement, deleteElements, widthPx: cw, heightPx: ch } =
        useCanvasStore.getState();
      if (selectedIds.length === 0) return;

      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key);
      const isDel   = e.key === "Delete" || e.key === "Backspace";
      if (!isArrow && !isDel) return;
      e.preventDefault();

      if (isDel) { deleteElements(selectedIds); return; }

      const step = e.shiftKey ? NUDGE_BIG : NUDGE_SMALL;
      for (const id of selectedIds) {
        const el = elements.find((el) => el.id === id);
        if (!el) continue;
        if (e.key === "ArrowLeft")  updateElement(id, { x: Math.max(0,       el.x - step) });
        if (e.key === "ArrowRight") updateElement(id, { x: Math.min(cw - el.w, el.x + step) });
        if (e.key === "ArrowUp")    updateElement(id, { y: Math.max(0,       el.y - step) });
        if (e.key === "ArrowDown")  updateElement(id, { y: Math.min(ch - el.h, el.y + step) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Grid background (in display pixels) ──────────────────────────────────
  const cellPx = Math.round(gridPx * displayScale);
  const gridStyle: React.CSSProperties = snapEnabled
    ? {
        backgroundImage: [
          `linear-gradient(to right,  rgba(99,102,241,0.15) 1px, transparent 1px)`,
          `linear-gradient(to bottom, rgba(99,102,241,0.15) 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: `${cellPx}px ${cellPx}px`,
      }
    : {};

  const cardW = widthPx  * displayScale;
  const cardH = heightPx * displayScale;

  return (
    // Fills the grey editor area — Selecto rubber-band starts anywhere here
    <div ref={setOuterEl} className="absolute inset-0">
      {outerEl && (
        <Selecto
          ref={selectoRef}
          container={outerEl}
          selectableTargets={[".rnd-el"]}
          selectByClick={false}
          selectFromInside={false}
          continueSelect={false}
          ratio={0}
          hitRate={0}
          dragCondition={(e) =>
            !(e.inputEvent.target as HTMLElement).closest(".rnd-el")
          }
          onSelect={(e) => {
            const ids = e.selected
              .map((el) => el.getAttribute("data-el-id"))
              .filter((id): id is string => id !== null);
            if (ids.length === 0) useCanvasStore.getState().setSelected(null);
            else useCanvasStore.setState({ selectedIds: ids });
          }}
        />
      )}

      {/* White label card — centred, no CSS transform */}
      <div className="flex h-full w-full items-center justify-center">
        <div
          ref={containerRef}
          className="relative bg-white shadow-xl"
          style={{ width: cardW, height: cardH, ...gridStyle }}
          onClick={(e) => {
            if (e.target === containerRef.current) setSelected(null);
          }}
        >
          {elementIds.map((id) => (
            <RndElement
              key={id}
              id={id}
              ds={displayScale}
              gridPx={gridPx}
              snapEnabled={snapEnabled}
              selectoRef={selectoRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

