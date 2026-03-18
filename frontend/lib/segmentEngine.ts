/**
 * segmentEngine.ts
 *
 * Utilities for the v2 mixed-text segment model (TextSegment[]).
 *
 * The segment model allows a single TextElement to contain an arbitrary
 * mix of literal text and GS1 AI variable pills, e.g.:
 *   [literal "批次: "] [variable "10"] [literal "  有效期: "] [variable "17"]
 *
 * This module is pure (no DOM / React / bwip-js) and safe in any context.
 */

import type { TextSegment, GS1AiField } from "@/types/template";
import { findAiValue } from "@/lib/gs1Utils";

// ─── Mock data (used in canvas preview while editing) ────────────────────────

export const MOCK_DATA: Record<GS1AiField, string> = {
  "01": "09506000134376",
  "10": "LOT001",
  "11": "240101",
  "17": "260101",
  "21": "SN123456",
};

/** Human-readable labels for the AI fields (for display in variable pills). */
export const SEGMENT_AI_LABELS: Record<GS1AiField, string> = {
  "01": "UDI-DI",
  "10": "批次号",
  "11": "生产日期",
  "17": "有效期",
  "21": "序列号",
};

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Resolve a segment list to a plain string using live HRI data.
 *
 * @param segments - The segment list to resolve.
 * @param hri      - The full HRI string "(01)xxx(17)xxx…" used to extract AI values.
 */
export function resolveSegments(segments: TextSegment[], hri: string): string {
  return segments
    .map((seg) => {
      if (seg.kind === "literal") return seg.text;
      const val = findAiValue(hri, seg.ai);
      return val ?? "";
    })
    .join("");
}

/**
 * Resolve a segment list to a preview string using mock data.
 * Used in the canvas editor so elements can show meaningful placeholder text.
 *
 * @param segments  - The segment list to preview.
 * @param mockData  - Optional override of the default MOCK_DATA map.
 */
export function segmentsPreview(
  segments: TextSegment[],
  mockData: Record<GS1AiField, string> = MOCK_DATA,
): string {
  return segments
    .map((seg) => {
      if (seg.kind === "literal") return seg.text;
      return mockData[seg.ai] ?? `(${seg.ai})`;
    })
    .join("");
}

// ─── Migration helpers ────────────────────────────────────────────────────────

/**
 * Convert a legacy (content + fieldBinding) pair to a segments array.
 * This is the read-path: old templates load fine via this conversion.
 */
export function legacyToSegments(
  content: string,
  fieldBinding: GS1AiField | null,
): TextSegment[] {
  if (fieldBinding) {
    // Legacy: the whole element is bound to a single AI field.
    // Represent as a single variable segment.
    return [{ kind: "variable", ai: fieldBinding }];
  }
  // Legacy: plain static text.
  return content ? [{ kind: "literal", text: content }] : [];
}

/**
 * Convert a segments array back to (content, fieldBinding) for backwards-compatible storage.
 * Used when saving to the backend, which may still rely on the legacy fields.
 *
 * Strategy:
 * - If segments has exactly one variable segment → set fieldBinding + content = ""
 * - Otherwise → join all literals as content, fieldBinding = null
 */
export function segmentsToLegacy(segments: TextSegment[]): {
  content: string;
  fieldBinding: GS1AiField | null;
} {
  if (segments.length === 1 && segments[0].kind === "variable") {
    return { content: "", fieldBinding: segments[0].ai };
  }
  const content = segments
    .map((seg) => {
      if (seg.kind === "literal") return seg.text;
      return `(${seg.ai})`;
    })
    .join("");
  return { content, fieldBinding: null };
}

/**
 * Normalise a TextElement's segment list:
 * - If the element already has segments, return them.
 * - Otherwise construct segments from the legacy fields.
 */
export function getSegments(
  el: { content: string; fieldBinding: GS1AiField | null; segments?: TextSegment[] },
): TextSegment[] {
  if (el.segments && el.segments.length > 0) return el.segments;
  return legacyToSegments(el.content, el.fieldBinding);
}
