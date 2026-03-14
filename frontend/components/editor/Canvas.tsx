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
  const selectedId = useCanvasStore((s) => s.selectedId);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const updateElement = useCanvasStore((s) => s.updateElement);

  if (!el) return null;

  const isSelected = selectedId === id;
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
      onMouseDown={() => setSelected(id)}
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

      const { selectedId, elements, updateElement, deleteElement, widthPx: cw, heightPx: ch } =
        useCanvasStore.getState();
      if (!selectedId) return;

      const el = elements.find((el) => el.id === selectedId);
      if (!el) return;

      const step = e.shiftKey ? NUDGE_BIG : NUDGE_SMALL;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        updateElement(selectedId, { x: Math.max(0, el.x - step) });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        updateElement(selectedId, { x: Math.min(cw - el.w, el.x + step) });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        updateElement(selectedId, { y: Math.max(0, el.y - step) });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        updateElement(selectedId, { y: Math.min(ch - el.h, el.y + step) });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteElement(selectedId);
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

