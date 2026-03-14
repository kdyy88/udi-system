/**
 * Pure SVG label template generators — no DOM / React / Node.js APIs.
 * Safe to call in any context (export path, thumbnail preview, etc.)
 *
 * renderCustomSvg: the single renderer for v3.5+ canvas-based templates.
 *
 * ⚠️  Do NOT call bwip-js here inside the editor path.
 *     bwip-js is only called when a CanvasDefinition is exported (ZIP / preview).
 */

import type { CanvasDefinition, BarcodeType } from "@/types/template";
import { findAiText as _findAiText, findAiValue as _findAiValue, escapeXml as _escapeXml } from "@/lib/gs1Utils";

export type LabelSvgInput = {
  gtin: string;
  hri: string;
  batch_no?: string | null;
  expiry_date?: string | null;
  serial_no?: string | null;
  production_date?: string | null;
  /** bwip-js toSVG() output for the GS1 DataMatrix (full HRI) */
  dataMatrixSvg: string;
  /** bwip-js toSVG() output for full GS1-128 (full HRI) */
  gs1128Svg: string | null;
  /** bwip-js toSVG() output for DI-only GS1-128: "(01){gtin}" */
  gs1128DiSvg: string | null;
  /** bwip-js toSVG() output for PI-only GS1-128: all AIs except (01) */
  gs1128PiSvg: string | null;
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function extractSvgInner(svg: string): { inner: string; vw: number; vh: number } {
  const m = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  return {
    inner: svg.replace(/<\/?svg[^>]*>/g, ""),
    vw: m ? parseFloat(m[1]) : 100,
    vh: m ? parseFloat(m[2]) : 100,
  };
}

/** Embed an SVG body into a bounding box (ox, oy, maxW, maxH) using a nested <svg>.
 *  @param preserveAspectRatio - SVG preserveAspectRatio attribute.
 *    "none"          → stretch to fill the box completely (default for barcodes).
 *    "xMidYMid meet" → uniform scale, centered, with possible gaps.
 */
export function embedSvg(
  svg: string,
  ox: number,
  oy: number,
  maxW: number,
  maxH: number,
  preserveAspectRatio = "none",
): { g: string; w: number; h: number } {
  const { inner, vw, vh } = extractSvgInner(svg);
  const g = `<svg x="${ox}" y="${oy}" width="${maxW}" height="${maxH}" viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="${preserveAspectRatio}">${inner}</svg>`;
  return { g, w: maxW, h: maxH };
}

// ─── helper: pick the correct barcode SVG for a BarcodeType ──────────────────

function pickBarcodeSvg(barcodeType: BarcodeType, input: LabelSvgInput): string | null {
  switch (barcodeType) {
    case "datamatrix": return input.dataMatrixSvg;
    case "gs1128":     return input.gs1128Svg;
    case "gs1128_di":  return input.gs1128DiSvg ?? input.gs1128Svg;
    case "gs1128_pi":  return input.gs1128PiSvg ?? input.gs1128Svg;
  }
}

// ─── renderCustomSvg (EXPORT / THUMBNAIL path — bwip-js already called) ──────

/**
 * Renders a CanvasDefinition to a pure SVG string using real barcode data.
 * ⚠️  Never call this inside the editor canvas (editing path). Export only.
 */
export function renderCustomSvg(input: LabelSvgInput, canvas: CanvasDefinition): string {
  const W = canvas.widthPx;
  const H = canvas.heightPx;
  const parts: string[] = [];

  for (const el of canvas.elements) {
    switch (el.type) {
      case "barcode": {
        const svg = pickBarcodeSvg(el.barcodeType, input);
        if (svg) {
          parts.push(embedSvg(svg, el.x, el.y, el.w, el.h).g);
        } else {
          parts.push(
            `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="#eee" stroke="#ccc"/>`,
          );
        }
        break;
      }

      case "text": {
        const resolvedText = el.fieldBinding
          ? (() => {
              const val = _findAiValue(input.hri, el.fieldBinding);
              return val ? `(${el.fieldBinding})${val}` : el.content;
            })()
          : el.content;

        const anchor =
          el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
        const tx =
          el.textAlign === "center"
            ? el.x + el.w / 2
            : el.textAlign === "right"
              ? el.x + el.w
              : el.x;
        const ty = el.y + el.fontSize;

        parts.push(
          `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-family="sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="#111">${_escapeXml(resolvedText)}</text>`,
        );
        break;
      }

      case "rect": {
        parts.push(
          `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`,
        );
        break;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${parts.join("\n  ")}
</svg>`;
}

// ─── Re-exports for any remaining call sites ──────────────────────────────────
export { _findAiText as findAiText, _findAiValue as findAiValue, _escapeXml as escapeXml };
