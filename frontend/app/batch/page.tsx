"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Upload, Download, CheckCircle, AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/labels/PageHeader";
import { Button } from "@/components/ui/button";
import { useBatchUpload } from "@/hooks/useBatchUpload";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { CanvasDefinition } from "@/types/template";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import { TemplatePreviewDialog } from "@/components/editor/TemplatePreviewDialog";

// ─── Template Excel Generator ─────────────────────────────────────────────────

function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();
  // Headers must exactly match COLUMN_MAP keys in excelParser.ts
  const headers = ["GTIN-14", "批次号", "有效期", "序列号", "生产日期", "备注"];
  // GTINs must have a valid GS1 Mod-10 check digit (last digit)
  const examples = [
    ["09506000134383", "LOT001", "261231", "SN000001", "250101", "示例行1"],
    ["09506000134383", "LOT002", "261231", "", "", "示例行2"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, "UDI标签");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), "UDI_Label_Template.xlsx");
}

// ─── Parsed Rows Table ─────────────────────────────────────────────────────────

function ParsedRowsTable({ rows }: { rows: ReturnType<typeof useBatchUpload>["rows"] }) {
  const valid = rows.filter((r) => r.validationError === null).length;
  const invalid = rows.length - valid;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">共 {rows.length} 行</span>
        <span className="text-green-600">✓ 有效: {valid}</span>
        {invalid > 0 && <span className="text-destructive">✗ 错误: {invalid}</span>}
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border text-sm">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/80">
            <tr>
              {["行", "GTIN-14", "批次号", "生产日期", "有效期", "序列号", "状态"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, i) => (
              <tr key={i} className={row.validationError ? "bg-destructive/5" : ""}>
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{row.rowIndex + 1}</td>
                <td className="px-3 py-1.5 font-mono">{row.di}</td>
                <td className="px-3 py-1.5">{row.lot ?? "—"}</td>
                <td className="px-3 py-1.5">{row.production_date ?? "—"}</td>
                <td className="px-3 py-1.5">{row.expiry ?? "—"}</td>
                <td className="px-3 py-1.5">{row.serial ?? "—"}</td>
                <td className="px-3 py-1.5">
                  {row.validationError ? (
                    <span className="text-destructive">{row.validationError}</span>
                  ) : (
                    <span className="text-green-600">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>生成标签中…</span>
        <span>
          {current} / {total} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">拖入 Excel 文件或点击上传</p>
        <p className="text-sm text-muted-foreground">.xlsx / .xls，最多 500 行</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchPage() {
  const { authUser, checkingAuth } = useRequireAuth();
  const [templateDefinition, setTemplateDefinition] = useState<CanvasDefinition | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewTemplateDefinition, setPreviewTemplateDefinition] = useState<CanvasDefinition | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { phase, rows, errorMsg, progress, batchId, handleFileSelect, startGenerate, reset } =
    useBatchUpload();

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态…</main>;
  }

  const validRows = rows.filter((r) => r.validationError === null);
  const isIdle = phase === "idle";
  const isParsing = phase === "parsing";
  const isValidated = phase === "validated";
  const isSaving = phase === "saving";
  const isGenerating = phase === "generating";
  const isDone = phase === "done";
  const isError = phase === "error";
  const previewRow = validRows[0] ?? null;
  const invalidRows = rows.filter((r) => r.validationError !== null);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <PageHeader title="批量打码通道" titleClassName="text-2xl font-semibold" />

      {/* Download Template */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
        <Download className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">下载 Excel 模板</p>
          <p className="text-xs text-muted-foreground">按模板格式填写后上传，支持最多 500 行</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadExcelTemplate}>
          下载模板
        </Button>
      </div>

      {/* Upload Zone */}
      {(isIdle || isError) && (
        <div className="space-y-3">
          <DropZone onFile={handleFileSelect} />
          {isError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">错误</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parsing indicator */}
      {isParsing && (
        <div className="flex items-center gap-3 rounded-xl border p-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">正在解析文件…</span>
        </div>
      )}

      {/* Validated: show table + template picker + action buttons */}
      {(isValidated || isSaving || isGenerating || isDone) && (
        <div className="space-y-5">
          <ParsedRowsTable rows={rows} />

          {invalidRows.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">发现 {invalidRows.length} 行校验失败</p>
                <p>请先修正表格中的错误后重新上传；日期字段仅支持 YYMMDD、YY/MM/DD 或 YYYY-MM-DD。</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="font-medium">选择标签模板</h2>
            {authUser && (
              <TemplateGallery
                mode="select"
                selectedId={selectedTemplateId}
                canPreview={Boolean(previewRow)}
                onPreview={(def, name) => {
                  setPreviewTemplateDefinition(def);
                  setPreviewTemplateName(name);
                  setPreviewOpen(true);
                }}
                onSelect={(def, id) => {
                  setTemplateDefinition(def);
                  setSelectedTemplateId(id);
                }}
              />
            )}
            {!templateDefinition && (
              <p className="text-sm text-muted-foreground">
                请选择一个标签模板后再生成 ·{" "}
                <Link href="/editor" className="text-primary hover:underline">
                  新建模板 →
                </Link>
              </p>
            )}
          </div>

          <TemplatePreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            row={previewRow}
            templateDefinition={previewTemplateDefinition}
            templateName={previewTemplateName}
          />

          {isGenerating && <ProgressBar current={progress.current} total={progress.total} />}

          {isDone && (
            <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-700 dark:text-green-400">
                  ZIP 已下载，共 {validRows.length} 个标签
                </p>
                {batchId != null && (
                  <Link
                    href={`/history/batch/${batchId}`}
                    className="text-sm text-primary underline-offset-2 hover:underline"
                  >
                    查看批次详情 →
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {isValidated && (
              <Button
                disabled={validRows.length === 0 || !templateDefinition}
                onClick={() => templateDefinition && startGenerate(templateDefinition)}
              >
                保存并生成 ({validRows.length} 个标签)
              </Button>
            )}
            {isSaving && (
              <Button disabled>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                保存中…
              </Button>
            )}
            {isGenerating && (
              <Button disabled>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                生成中…
              </Button>
            )}
            <Button variant="outline" onClick={reset}>
              {isDone ? "新建批次" : "重置"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
