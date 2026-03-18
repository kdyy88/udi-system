"use client";

/**
 * SegmentEditor — mixed-text pill/chip editor.
 *
 * Each TextSegment is rendered as a draggable pill:
 *   - Literal pill  : an inline-editable text input with a grey background.
 *   - Variable pill : a blue badge showing the GS1 AI field name with an × button.
 *
 * At the end of the pill list there is an "append" input.
 * Typing "/" (or the "/" key) opens a popover with the full GS1 AI field list.
 * Selecting a field item inserts a variable pill at the cursor position.
 *
 * Drag-and-drop (HTML5 native) lets the user reorder pills.
 */

import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TextSegment, GS1AiField } from "@/types/template";
import { GS1_AI_LABELS } from "@/types/template";
import { SEGMENT_AI_LABELS } from "@/lib/segmentEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  segments: TextSegment[];
  onChange: (segments: TextSegment[]) => void;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function SegmentEditor({ segments, onChange }: Props) {
  const [appendText, setAppendText] = useState("");
  const [showPopover, setShowPopover] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);

  // ── Mutation helpers ─────────────────────────────────────────────────────────

  /** Replace segment list, merging adjacent literals. */
  const commit = (newSegs: TextSegment[]) => {
    const merged: TextSegment[] = [];
    for (const seg of newSegs) {
      const prev = merged[merged.length - 1];
      if (seg.kind === "literal" && prev?.kind === "literal") {
        merged[merged.length - 1] = { kind: "literal", text: prev.text + seg.text };
      } else if (seg.kind !== "literal" || seg.text !== "") {
        merged.push(seg);
      }
    }
    onChange(merged);
  };

  const updateLiteral = (index: number, text: string) => {
    const next = [...segments];
    next[index] = { kind: "literal", text };
    onChange(next);
  };

  const removeSegment = (index: number) => {
    commit(segments.filter((_, i) => i !== index));
  };

  const insertVariable = (ai: GS1AiField) => {
    const pre = appendText ? [{ kind: "literal" as const, text: appendText }] : [];
    commit([...segments, ...pre, { kind: "variable" as const, ai }]);
    setAppendText("");
    setShowPopover(false);
    setTimeout(() => appendInputRef.current?.focus(), 0);
  };

  const commitAppend = () => {
    if (!appendText) return;
    commit([...segments, { kind: "literal", text: appendText }]);
    setAppendText("");
  };

  // ── Drag-and-drop ────────────────────────────────────────────────────────────

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTarget(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropTarget(null);
      return;
    }
    const next = [...segments];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    commit(next);
    setDragIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTarget(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 min-h-9 cursor-text"
      onClick={() => appendInputRef.current?.focus()}
    >
      {segments.map((seg, i) => {
        const isDragging = dragIndex === i;
        const isDropTarget = dropTarget === i && dragIndex !== null && dragIndex !== i;

        if (seg.kind === "variable") {
          return (
            <span
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={[
                "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium select-none",
                "bg-blue-100 text-blue-800 border-blue-300",
                isDragging ? "opacity-40" : "opacity-100",
                isDropTarget ? "ring-2 ring-blue-400" : "",
                "cursor-grab",
              ].join(" ")}
            >
              {SEGMENT_AI_LABELS[seg.ai]}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeSegment(i); }}
                className="ml-0.5 rounded-sm hover:bg-blue-200 focus:outline-none"
                tabIndex={-1}
              >
                <X className="size-2.5" />
              </button>
            </span>
          );
        }

        // Literal segment — inline-editable input pill
        return (
          <span
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            className={[
              "inline-flex items-center gap-0.5 rounded border border-input bg-muted px-1.5 py-0.5",
              isDragging ? "opacity-40" : "opacity-100",
              isDropTarget ? "ring-2 ring-primary" : "",
              "cursor-grab",
            ].join(" ")}
          >
            <input
              className="h-4 min-w-[32px] bg-transparent text-xs outline-none cursor-text"
              style={{ width: `${Math.max(32, seg.text.length * 7 + 8)}px` }}
              value={seg.text}
              placeholder="…"
              onChange={(e) => updateLiteral(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && seg.text === "") removeSegment(i);
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSegment(i); }}
              className="shrink-0 rounded-sm hover:bg-muted-foreground/20 focus:outline-none"
              tabIndex={-1}
            >
              <X className="size-2.5 text-muted-foreground" />
            </button>
          </span>
        );
      })}

      {/* Append / slash-command input */}
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        {/* Invisible trigger — popover opened programmatically via open={showPopover} */}
        <PopoverTrigger
          className="sr-only h-0 w-0 overflow-hidden p-0"
          tabIndex={-1}
          aria-hidden
        />

        <input
          ref={appendInputRef}
          className="min-w-[48px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder={segments.length === 0 ? "输入文本，/ 插入变量…" : "/ 变量"}
          value={appendText}
          onChange={(e) => {
            const val = e.target.value;
            if (val.endsWith("/")) {
              setAppendText(val.slice(0, -1));
              setShowPopover(true);
            } else {
              setAppendText(val);
            }
          }}
          onBlur={commitAppend}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAppend();
            }
            if (e.key === "Backspace" && appendText === "" && segments.length > 0) {
              removeSegment(segments.length - 1);
            }
            if (e.key === "/" && !appendText) {
              e.preventDefault();
              setShowPopover(true);
            }
          }}
        />

        <PopoverContent className="w-52 p-1" align="start" side="top">
          <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">插入变量字段</p>
          {(Object.entries(GS1_AI_LABELS) as [GS1AiField, string][]).map(([ai, label]) => (
            <button
              key={ai}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
              onMouseDown={(e) => {
                // Prevent input blur before we've committed the append
                e.preventDefault();
                insertVariable(ai);
              }}
            >
              {label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
