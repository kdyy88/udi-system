/**
 * useBatchUpload — state machine for the 6-phase batch upload pipeline.
 *
 * Rendering uses the SAME path as single-label export:
 *   barcode-svg.ts → PreviewTemplateCanvas → html-to-image → JSZip
 *
 * Phase transitions:
 *   idle → parsing → validated → saving → generating → done | error
 */
import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import { api } from "@/lib/api";
import { parseExcelFile } from "@/lib/excelParser";
import { exportBatchToZip, fetchAllBatchLabels } from "@/lib/batchExporter";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import type { BatchTemplate, GenerateProgress, BatchPhase, ParsedRow } from "@/types/batch";

type BatchCreateResponse = {
  batch_id: number;
  name: string;
  source: string;
  total_count: number;
  created_at: string;
};

type State = {
  phase: BatchPhase;
  rows: ParsedRow[];
  errorMsg: string | null;
  progress: GenerateProgress;
  batchId: number | null;
  fileName: string;
};

const INITIAL_STATE: State = {
  phase: "idle",
  rows: [],
  errorMsg: null,
  progress: { current: 0, total: 0 },
  batchId: null,
  fileName: "",
};

export function useBatchUpload(userId: number) {
  const [state, setState] = useState<State>(INITIAL_STATE);

  const set = useCallback((patch: Partial<State>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── 1. Parse Excel file ────────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (file: File) => {
      set({ phase: "parsing", errorMsg: null, rows: [], fileName: file.name });
      try {
        const rows = await parseExcelFile(file);
        set({ phase: "validated", rows });
      } catch (err) {
        set({ phase: "error", errorMsg: err instanceof Error ? err.message : "文件解析失败" });
      }
    },
    [set],
  );

  // ── 2. Save to backend then render via PreviewTemplateCanvas ──────────────
  const startGenerate = useCallback(
    async (template: BatchTemplate) => {
      if (state.phase !== "validated" || userId === 0) return;

      const validRows = state.rows.filter((r) => r.validationError === null);
      if (validRows.length === 0) {
        set({ phase: "error", errorMsg: "没有通过验证的数据行" });
        return;
      }

      set({ phase: "saving", errorMsg: null });

      let batchId: number;
      const batchName = state.fileName.replace(/\.[^.]+$/, "") || "批量上传";
      try {
        const res = await api.post<BatchCreateResponse>(BATCHES_API_ROUTES.batchGenerate, {
          user_id: userId,
          name: batchName,
          source: "excel",
          items: validRows.map((r) => ({
            di: r.di,
            lot: r.lot,
            expiry: r.expiry,
            serial: r.serial,
            production_date: r.production_date,
            remarks: r.remarks,
          })),
        });
        batchId = res.data.batch_id;
      } catch (err: unknown) {
        set({
          phase: "error",
          errorMsg: err instanceof Error ? err.message : "保存失败，请检查数据后重试",
        });
        return;
      }

      set({ phase: "generating", batchId, progress: { current: 0, total: validRows.length } });

      try {
        // Fetch the backend-persisted records (authoritative HRI strings)
        const labels = await fetchAllBatchLabels(batchId, userId);

        const blob = await exportBatchToZip({
          batchId,
          batchName,
          labels,
          template,
          onProgress: (current, total) => set({ progress: { current, total } }),
        });

        const zipName = `UDI_${batchName}_${batchId}.zip`;
        saveAs(blob, zipName);
        set({ phase: "done" });
      } catch (err) {
        set({ phase: "error", errorMsg: err instanceof Error ? err.message : "标签生成失败" });
      }
    },
    [state.phase, state.rows, state.fileName, userId, set],
  );

  // ── 3. Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return {
    phase: state.phase,
    rows: state.rows,
    errorMsg: state.errorMsg,
    progress: state.progress,
    batchId: state.batchId,
    handleFileSelect,
    startGenerate,
    reset,
  };
}
