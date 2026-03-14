"use client";

/**
 * Canvas.tsx — react-rnd drag/resize whiteboard.
 *
 * Key design decisions:
 * - All coordinates/sizes in raw px (no unit conversion in drag callbacks)
 * - CSS transform:scale(zoom) on the canvas container handles display scaling
 * - react-rnd `scale={zoom}` prop corrects drag/resize event offsets when zoomed
 * - BarcodeElements render as placeholder divs only — bwip-js never called here
 * - Each RndElement subscribes only to its own element slice via Zustand selector
 *
 * Level 1 — Keyboard nudging:
 *   Arrow keys  → move selected element ±1px
 *   Shift+Arrow → move selected element ±10px
 *   Delete/Backspace → delete selected element
 *
 * Level 2 — Grid / Snap:
 *   When snapEnabled, visual CSS grid is drawn and react-rnd dragGrid/resizeGrid are set.
 */

import { useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore, barcodeAspectRatio } from "@/stores/canvasStore";
import type { CanvasElement } from "@/types/template";

const MIN_SIZE = 10;
/** Step for Shift+Arrow nudge (px). */
const NUDGE_BIG = 10;
/** Step for plain Arrow nudge (px). */
const NUDGE_SMALL = 1;

// ─── Individual draggable/resizable element ───────────────────────────────────

function RndElement({ id, zoom, gridPx, snapEnabled }: { id: string; zoom: number; gridPx: number; snapEnabled: boolean }) {
  const el = useCanvasStore((s) => s.elements.find((e) => e.id === id));
  const isSelected = useCanvasStore((s) => s.selectedIds.includes(id));
  const setSelected = useCanvasStore((s) => s.setSelected);
  const toggleSelected = useCanvasStore((s) => s.toggleSelected);
  const updateElement = useCanvasStore((s) => s.updateElement);
  if (!el) return null;

  const aspectLock = el.type === "barcode" ? barcodeAspectRatio(el.barcodeType) : false;
  const snapGrid: [number, number] = snapEnabled ? [gridPx, gridPx] : [8, 8];

  return (
    <Rnd
      size={{ width: el.w, height: el.h }}
      position={{ x: el.x, y: el.y }}
      bounds="parent"
      scale={zoom}
      minWidth={MIN_SIZE}
      minHeight={MIN_SIZE}
      lockAspectRatio={aspectLock}
      dragGrid={snapGrid}
      resizeGrid={snapGrid}
      onMouseDown={(e) => {
        // Shift+click: toggle into multi-selection; plain click: single-select
        if ((e as MouseEvent).shiftKey) {
          toggleSelected(id);
        } else {
          setSelected(id);
        }
      }}
      onDragStop={(_e, d) => {
        updateElement(id, { x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        updateElement(id, {
          w: ref.offsetWidth,
          h: ref.offsetHeight,
          x: pos.x,
          y: pos.y,
        });
      }}
      style={{
        outline: isSelected ? "2px solid #3b82f6" : "none",
        outlineOffset: "1px",
        cursor: "move",
        userSelect: "none",
      }}
    >
      <ElementContent el={el} />
    </Rnd>
  );
}

function ElementContent({ el }: { el: CanvasElement }) {
  if (el.type === "barcode") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-400 bg-gray-100 text-xs text-gray-500 select-none pointer-events-none">
        {el.barcodeType}
      </div>
    );
  }

  if (el.type === "text") {
    const label = el.fieldBinding ? `<${fieldBindingLabel(el.fieldBinding)}>` : el.content;
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden pointer-events-none"
        style={{
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          justifyContent:
            el.textAlign === "center"
              ? "center"
              : el.textAlign === "right"
                ? "flex-end"
                : "flex-start",
          color: "#111",
          fontFamily: "sans-serif",
        }}
      >
        <span className="truncate">{label}</span>
      </div>
    );
  }

  if (el.type === "rect") {
    return (
      <div
        className="h-full w-full pointer-events-none"
        style={{
          background: el.fill === "none" ? "transparent" : el.fill,
          border: `${el.strokeWidth}px solid ${el.stroke}`,
          boxSizing: "border-box",
        }}
      />
    );
  }

  return null;
}

function fieldBindingLabel(ai: string): string {
  const labels: Record<string, string> = {
    "01": "UDI-DI",
    "10": "批次号",
    "11": "生产日期",
    "17": "有效期",
    "21": "序列号",
  };
  return labels[ai] ?? ai;
}

// ─── Canvas container ─────────────────────────────────────────────────────────

export function Canvas({ zoom = 1 }: { zoom?: number }) {
  const widthPx = useCanvasStore((s) => s.widthPx);
  const heightPx = useCanvasStore((s) => s.heightPx);
  const elementIds = useCanvasStore(useShallow((s) => s.elements.map((e) => e.id)));
  const setSelected = useCanvasStore((s) => s.setSelected);
  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const gridPx = useCanvasStore((s) => s.gridPx);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Level 1: Keyboard nudging ────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore when focused in an input / textarea / select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const { selectedIds, elements, updateElement, deleteElements, widthPx: cw, heightPx: ch } =
        useCanvasStore.getState();
      if (selectedIds.length === 0) return;

      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key);
      const isDel = e.key === "Delete" || e.key === "Backspace";
      if (!isArrow && !isDel) return;
      e.preventDefault();

      if (isDel) {
        deleteElements(selectedIds);
        return;
      }

      // Nudge: plain Arrow = ±1px, Shift+Arrow = ±10px
      // (when Shift is held for multi-select clicks we still want nudge — it's unambiguous
      //  because Shift+Arrow never triggers toggleSelected)
      const step = e.shiftKey ? NUDGE_BIG : NUDGE_SMALL;
      for (const id of selectedIds) {
        const el = elements.find((el) => el.id === id);
        if (!el) continue;
        if (e.key === "ArrowLeft")  updateElement(id, { x: Math.max(0, el.x - step) });
        if (e.key === "ArrowRight") updateElement(id, { x: Math.min(cw - el.w, el.x + step) });
        if (e.key === "ArrowUp")    updateElement(id, { y: Math.max(0, el.y - step) });
        if (e.key === "ArrowDown")  updateElement(id, { y: Math.min(ch - el.h, el.y + step) });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Level 2: Grid background ─────────────────────────────────────────────
  const gridStyle: React.CSSProperties = snapEnabled
    ? {
        backgroundImage: [
          `linear-gradient(to right,  rgba(99,102,241,0.12) 1px, transparent 1px)`,
          `linear-gradient(to bottom, rgba(99,102,241,0.12) 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: `${gridPx}px ${gridPx}px`,
      }
    : {};

  return (
    // Outer scroll container — fixed display size
    <div className="overflow-auto rounded-lg border bg-muted/30 p-4">
      {/* Transform wrapper — applies zoom */}
      <div
        style={{
          transformOrigin: "top left",
          transform: `scale(${zoom})`,
          width: widthPx * zoom,
          height: heightPx * zoom,
        }}
      >
        {/* Actual canvas — react-rnd elements live here */}
        <div
          ref={containerRef}
          className="relative bg-white shadow"
          style={{ width: widthPx, height: heightPx, ...gridStyle }}
          onClick={(e) => {
            if (e.target === containerRef.current) setSelected(null);
          }}
        >
          {elementIds.map((id) => (
            <RndElement key={id} id={id} zoom={zoom} gridPx={gridPx} snapEnabled={snapEnabled} />
          ))}
        </div>
      </div>
    </div>
  );
}

