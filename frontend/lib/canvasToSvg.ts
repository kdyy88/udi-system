/**
 * canvasToSvg.ts
 *
 * Client-side only (uses @bwip-js/browser).
 * Converts a CanvasDefinition + label data into a ready-to-download SVG string.
 *
 * This is the EXPORT path — bwip-js is called here for each barcode element,
 * respecting per-element `customText` overrides for non-GS1 types.
 */

import type { CanvasDefinition, BarcodeType } from "@/types/template";
import {
  createDataMatrixSvg,
  createNormalizedGs1Svg,
  createQrSvg,
  createAztecSvg,
  createEan13Svg,
  createEan8Svg,
  createCode128Svg,
} from "@/features/labels/preview/barcode-svg";
import { embedSvg, escapeXml } from "@/lib/svgTemplates";
import { getSegments, resolveSegments } from "@/lib/segmentEngine";
import { findAiText, findAiValue } from "@/lib/gs1Utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CanvasSvgInput = {
  /** Full GS1 HRI string, e.g. "(01)09506000134376(17)260101(10)LOT001" */
  hri: string;
};

// ─── Per-element barcode renderer ────────────────────────────────────────────

function renderBarcodeElement(
  barcodeType: BarcodeType,
  hri: string,
  customText?: string,
): string | null {
  // For non-GS1 types, customText overrides the HRI.
  const freeText = customText?.trim() || hri;

  switch (barcodeType) {
    case "datamatrix":
      return createDataMatrixSvg(hri);

    case "gs1128":
      return createNormalizedGs1Svg(hri);

    case "gs1128_di": {
      const gtin = findAiValue(hri, "01");
      return gtin
        ? createNormalizedGs1Svg(`(01)${gtin}`)
        : createNormalizedGs1Svg(hri);
    }

    case "gs1128_pi": {
      const piText = ["11", "17", "10", "21"]
        .map((ai) => findAiText(hri, ai))
        .filter(Boolean)
        .join("");
      return piText ? createNormalizedGs1Svg(piText) : createNormalizedGs1Svg(hri);
    }

    case "qrcode":
      return createQrSvg(freeText);

    case "aztec":
      return createAztecSvg(freeText);

    case "ean13":
      return createEan13Svg(freeText);

    case "ean8":
      return createEan8Svg(freeText);

    case "code128":
      return createCode128Svg(freeText);
  }
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Render a CanvasDefinition to a complete, self-contained SVG string.
 *
 * @param canvas - The canvas layout definition.
 * @param input  - The label data (hri string).
 * @returns A valid `<svg>…</svg>` string, or throws on critical error.
 */
export function renderCanvasToSvg(canvas: CanvasDefinition, input: CanvasSvgInput): string {
  const { widthPx: W, heightPx: H } = canvas;
  const parts: string[] = [];

  for (const el of canvas.elements) {
    switch (el.type) {
      case "barcode": {
        const svg = renderBarcodeElement(el.barcodeType, input.hri, el.customText);
        if (svg) {
          parts.push(embedSvg(svg, el.x, el.y, el.w, el.h).g);
        } else {
          // Fallback: grey placeholder rect with label
          parts.push(
            `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="#eee" stroke="#ccc"/>` +
            `<text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + 4}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#999">${el.barcodeType}</text>`,
          );
        }
        break;
      }

      case "text": {
        const segs = getSegments(el);
        const text = resolveSegments(segs, input.hri);

        const anchor =
          el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
        const tx =
          el.textAlign === "center"
            ? el.x + el.w / 2
            : el.textAlign === "right"
              ? el.x + el.w
              : el.x;
        // Vertically centre text within its box, matching the editor's flex-items-center.
        // `dominant-baseline="central"` places the visual centre at the y coordinate.
        const ty = el.y + el.h / 2;

        parts.push(
          `<text x="${tx}" y="${ty}" dominant-baseline="central" text-anchor="${anchor}" font-family="sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="#111">${escapeXml(text)}</text>`,
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

  // Render at 3× design units so the downloaded file opens at a comfortable
  // visual size in any SVG viewer, matching the editor's default displayScale.
  const scale = 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${parts.join("\n  ")}
</svg>`;
}

/**
 * Download a canvas as an `.svg` file in the browser.
 *
 * @param canvas   - The canvas layout definition.
 * @param input    - The label data.
 * @param filename - The desired filename (default: "label.svg").
 */
export function downloadCanvasAsSvg(
  canvas: CanvasDefinition,
  input: CanvasSvgInput,
  filename = "label.svg",
): void {
  const svgString = renderCanvasToSvg(canvas, input);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
