/**
 * Shared GS1 AI string helpers — single source of truth.
 * Used by svgTemplates.ts, batchExporter.ts, PreviewTemplateCanvas, batch/page.tsx
 */

/** Returns the full AI segment including parentheses, e.g. "(10)LOT001" */
export function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

/** Returns only the value after the AI, e.g. "LOT001" */
export function findAiValue(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)([^()]+)`))?.[1] ?? "";
}

/** XML-safe escaping for SVG text content */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
