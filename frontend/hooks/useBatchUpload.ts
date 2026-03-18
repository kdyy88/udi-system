import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import { api } from "@/lib/api";
import { parseExcelFile } from "@/lib/excelParser";
import { exportBatchToZip, iterateBatchLabels } from "@/lib/batchExporter";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import type { BatchCreateResponse, GenerateProgress, BatchPhase, ParsedRow } from "@/types/batch";
import type { CanvasDefinition } from "@/types/template";

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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useBatchUpload() {
  const [state, setState] = useState<State>(INITIAL_STATE);

  const set = useCallback((patch: Partial<State>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      set({ phase: "parsing", errorMsg: null, rows: [], fileName: file.name });
      try {
        const rows = await parseExcelFile(file);
        set({ phase: "validated", rows });
      } catch (err) {
        set({ phase: "error", errorMsg: getErrorMessage(err, "文件解析失败") });
      }
    },
    [set],
  );

  const startGenerate = useCallback(
    async (templateDefinition: CanvasDefinition) => {
      if (state.phase !== "validated") return;

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
          name: batchName,
          source: "excel",
          template_definition: templateDefinition,
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
      } catch (err) {
        set({
          phase: "error",
          errorMsg: getErrorMessage(err, "保存失败，请检查数据后重试"),
        });
        return;
      }

      set({ phase: "generating", batchId, progress: { current: 0, total: validRows.length } });

      try {
        const blob = await exportBatchToZip({
          batchId,
          batchName,
          labels: iterateBatchLabels(batchId),
          total: validRows.length,
          templateDefinition,
          onProgress: (current, total) => set({ progress: { current, total } }),
        });

        const zipName = `UDI_${batchName}_${batchId}.zip`;
        saveAs(blob, zipName);
        set({ phase: "done" });
      } catch (err) {
        set({ phase: "error", errorMsg: getErrorMessage(err, "标签生成失败") });
      }
    },
    [state.phase, state.rows, state.fileName, set],
  );

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
