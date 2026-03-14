/**
 * Batch label exporter — pure SVG, no DOM required.
 *
 * Pipeline:
 *   barcode-svg.ts (bwip-js) → svgTemplates.ts (renderCustomSvg) → JSZip (.svg files)
 */
import JSZip from "jszip";

import {
  createDataMatrixSvg,
  createNormalizedGs1Svg,
} from "@/features/labels/preview/barcode-svg";
import {
  renderCustomSvg,
  type LabelSvgInput,
} from "@/lib/svgTemplates";
import { findAiText } from "@/lib/gs1Utils";
import { api } from "@/lib/api";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import type { CanvasDefinition } from "@/types/template";
import type { LabelHistoryItem } from "@/types/udi";

const FETCH_PAGE_SIZE = 200;

// ─── fetch ───────────────────────────────────────────────────────────────────

export async function fetchAllBatchLabels(
  batchId: number,
  userId: number,
): Promise<LabelHistoryItem[]> {
  const all: LabelHistoryItem[] = [];
  let cursor: number | undefined = undefined;

  while (true) {
    const params: Record<string, string> = {
      user_id: String(userId),
      page_size: String(FETCH_PAGE_SIZE),
    };
    if (cursor != null) params.cursor = String(cursor);

    const res = await api.get<{
      labels: LabelHistoryItem[];
      next_cursor: number | null;
    }>(BATCHES_API_ROUTES.batchById(batchId), { params });

    all.push(...res.data.labels);
    if (!res.data.next_cursor) break;
    cursor = res.data.next_cursor;
  }

  return all;
}

// ─── render one label as SVG (no DOM) ────────────────────────────────────────

function renderLabelToSvg(
  label: LabelHistoryItem,
  templateDefinition: CanvasDefinition,
): string | null {
  const { hri } = label;

  const dataMatrixSvg = createDataMatrixSvg(hri);
  if (!dataMatrixSvg) return null;

  const diText = findAiText(hri, "01");
  const piText = ["11", "17", "10", "21"].map((ai) => findAiText(hri, ai)).filter(Boolean).join("");

  const input: LabelSvgInput = {
    gtin: label.gtin,
    hri,
    batch_no: label.batch_no,
    expiry_date: label.expiry_date,
    serial_no: label.serial_no,
    production_date: label.production_date,
    dataMatrixSvg,
    gs1128Svg: createNormalizedGs1Svg(hri),
    gs1128DiSvg: diText ? createNormalizedGs1Svg(diText) : null,
    gs1128PiSvg: piText ? createNormalizedGs1Svg(piText) : null,
  };

  return renderCustomSvg(input, templateDefinition);
}

// ─── public API ──────────────────────────────────────────────────────────────

export type BatchExportOptions = {
  batchId: number;
  batchName: string;
  labels: LabelHistoryItem[];
  templateDefinition: CanvasDefinition;
  onProgress: (current: number, total: number) => void;
};

/**
 * Render every label to SVG (pure vector, no DOM) and pack into a ZIP.
 */
export async function exportBatchToZip(options: BatchExportOptions): Promise<Blob> {
  const { labels, templateDefinition, onProgress } = options;
  const zip = new JSZip();
  const folder = zip.folder("labels")!;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const serial4 = label.serial_no?.trim()
      ? label.serial_no.trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 20)
      : String(i + 1).padStart(4, "0");

    const svg = renderLabelToSvg(label, templateDefinition);
    if (svg) {
      folder.file(`${label.gtin}_${serial4}.svg`, svg);
    }

    onProgress(i + 1, labels.length);
    // Yield to keep the UI responsive during large batches
    await new Promise((r) => setTimeout(r, 0));
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
