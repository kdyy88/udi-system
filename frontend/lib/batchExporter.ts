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

async function fetchBatchLabelsPage(
  batchId: number,
  cursor: number | undefined,
): Promise<{
  labels: LabelHistoryItem[];
  next_cursor: number | null;
}> {
  const params: Record<string, string> = {
    page_size: String(FETCH_PAGE_SIZE),
    sort: "asc",
  };
  if (cursor != null) params.cursor = String(cursor);

  const res = await api.get<{
    labels: LabelHistoryItem[];
    next_cursor: number | null;
  }>(BATCHES_API_ROUTES.batchById(batchId), { params });

  return res.data;
}

export async function* iterateBatchLabels(
  batchId: number,
): AsyncGenerator<LabelHistoryItem, void, void> {
  let cursor: number | undefined = undefined;

  while (true) {
    const page = await fetchBatchLabelsPage(batchId, cursor);
    for (const label of page.labels) {
      yield label;
    }

    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
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
  labels: Iterable<LabelHistoryItem> | AsyncIterable<LabelHistoryItem>;
  total: number;
  templateDefinition: CanvasDefinition;
  onProgress: (current: number, total: number) => void;
};

/**
 * Render every label to SVG (pure vector, no DOM) and pack into a ZIP.
 */
export async function exportBatchToZip(options: BatchExportOptions): Promise<Blob> {
  const { labels, total, templateDefinition, onProgress } = options;
  const zip = new JSZip();
  const folder = zip.folder("labels")!;

  let index = 0;
  for await (const label of labels) {
    const serial4 = label.serial_no?.trim()
      ? label.serial_no.trim().replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 20)
      : String(index + 1).padStart(4, "0");

    const svg = renderLabelToSvg(label, templateDefinition);
    if (svg) {
      folder.file(`${label.gtin}_${serial4}.svg`, svg);
    }

    index += 1;
    onProgress(index, total);
    // Yield to keep the UI responsive during large batches
    if (index % 20 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
