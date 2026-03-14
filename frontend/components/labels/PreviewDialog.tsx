"use client";

import { useRef, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { PreviewTemplateCanvas } from "./PreviewTemplateCanvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toDisplayDate } from "@/lib/dateUtils";
import { useBwipPreview } from "@/features/labels/preview/useLabelPreviewOrchestrator";
import { exportPreviewNode, type PreviewExportFormat } from "@/features/labels/preview/export";
import { saveLabelToBackend } from "@/features/labels/preview/save";
import { getAuthUser } from "@/lib/auth";
import type { PreviewSource } from "@/types/udi";
import { useListTemplates } from "@/hooks/useLabelTemplates";
import { recordToDefinition } from "@/types/template";
import { renderCustomSvg, type LabelSvgInput } from "@/lib/svgTemplates";
import { applyOverrides, SYSTEM_TEMPLATES } from "@/lib/systemTemplates";
import { useSystemTemplateOverrides } from "@/hooks/useSystemTemplateOverrides";

type PreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewSource: PreviewSource | null;
  expiryDate: string;
  onSaved?: () => void;
};

export function PreviewDialog({
  open,
  onOpenChange,
  previewSource,
  expiryDate,
  onSaved,
}: PreviewDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const authUser = getAuthUser();
  const { data: templateList } = useListTemplates(authUser?.user_id ?? 0);
  const templates = templateList?.items ?? [];

  const { data: overridesData } = useSystemTemplateOverrides();
  const effectiveSystemTemplates = applyOverrides(overridesData?.value ?? {});

  // Extract canonical fields regardless of source kind
  const previewMeta = useMemo(() => {
    if (!previewSource) return null;
    if (previewSource.kind === "local") {
      return {
        hri: previewSource.data.hri,
        di: previewSource.data.di,
        gs1Escaped: previewSource.data.gs1_element_string_escaped,
        expiryDate: expiryDate,
      };
    }
    return {
      hri: previewSource.data.hri,
      di: previewSource.data.gtin,
      gs1Escaped: previewSource.data.full_string.replace(/\x1d/g, "\\x1d"),
      expiryDate: previewSource.data.expiry_date ?? expiryDate,
    };
  }, [previewSource, expiryDate]);

  // All barcodes rendered synchronously in-browser — zero network requests
  const { datamatrixSvg, gs1128Svg, gs1128DiOnlySvg, gs1128PiOnlySvg, error: barcodeError } = useBwipPreview(
    previewMeta?.hri
  );

  // Build LabelSvgInput for custom template rendering
  const labelSvgInput = useMemo<LabelSvgInput | null>(() => {
    if (!previewMeta || !datamatrixSvg) return null;
    return {
      gtin: previewMeta.di,
      hri: previewMeta.hri,
      dataMatrixSvg: datamatrixSvg,
      gs1128Svg: gs1128Svg ?? null,
      gs1128DiSvg: gs1128DiOnlySvg ?? null,
      gs1128PiSvg: gs1128PiOnlySvg ?? null,
    };
  }, [previewMeta, datamatrixSvg, gs1128Svg, gs1128DiOnlySvg, gs1128PiOnlySvg]);

  // Render custom template SVG string when a template is selected
  const customSvgString = useMemo(() => {
    if (!selectedTemplateId || !labelSvgInput) return null;
    try {
      // System template
      const sysTmpl = effectiveSystemTemplates.find((t) => t.id === selectedTemplateId);
      if (sysTmpl) return renderCustomSvg(labelSvgInput, sysTmpl.canvas);
      // User template
      const record = templates.find((t) => String(t.id) === selectedTemplateId);
      if (record) return renderCustomSvg(labelSvgInput, recordToDefinition(record));
    } catch { /* fall through to default */ }
    return null;
  }, [selectedTemplateId, labelSvgInput, templates, effectiveSystemTemplates]);

  const handleDownload = async (format: PreviewExportFormat) => {
    if (!previewSource || !previewMeta) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    // Brand-new label: save to backend before downloading
    if (previewSource.kind === "local") {
      const user = getAuthUser();
      if (!user) { toast.error("请先登录"); return; }
      setSaving(true);
      try {
        await saveLabelToBackend(previewSource.data, user.user_id);
        toast.success("已保存至历史记录");
        onSaved?.();
      } catch {
        toast.error("保存失败，请检查网络后重试");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    // For custom template + SVG format, download the raw SVG string directly
    if (customSvgString && format === "svg") {
      const blob = new Blob([customSvgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "udi-label.svg";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!previewRef.current) { toast.error("暂无可下载的预览内容"); return; }
    try {
      await exportPreviewNode(previewRef.current, "label", format);
    } catch {
      toast.error("下载失败，请重试");
    }
  };

  // Build canvas preview data (always SVG via bwip-js)
  const canvasPreview = useMemo(() => {
    if (!previewMeta || !gs1128Svg || !datamatrixSvg) return null;
    return {
      format: "svg" as const,
      data: {
        hri: previewMeta.hri,
        datamatrix_svg: datamatrixSvg,
        gs1_128_svg: gs1128Svg,
        gs1_128_di_only_svg: gs1128DiOnlySvg,
        gs1_128_pi_only_svg: gs1128PiOnlySvg,
      },
    };
  }, [previewMeta, datamatrixSvg, gs1128Svg, gs1128DiOnlySvg, gs1128PiOnlySvg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>条码实时预览</DialogTitle>
          <DialogDescription>
            {previewSource?.kind === "local"
              ? "点击下载按钮将同时保存至历史记录"
              : "历史记录预览 · 支持下载"}
          </DialogDescription>
        </DialogHeader>

        {previewSource && previewMeta ? (
          <div className="mt-4 space-y-4">
            {/* Template selector */}
            <div className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-muted-foreground">标签模板</span>
              <select
                className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedTemplateId ?? ""}
                onChange={(e) =>
                  setSelectedTemplateId(e.target.value || null)
                }
              >
                <option value="">默认布局</option>
                <optgroup label="系统默认">
                  {effectiveSystemTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
                {templates.length > 0 && (
                  <optgroup label="我的模板">
                    {templates.map((t) => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Download buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(["png", "svg", "pdf"] as PreviewExportFormat[]).map((fmt) => (
                <Button
                  key={fmt}
                  size="sm"
                  variant="outline"
                  disabled={saving || !!barcodeError}
                  onClick={() => void handleDownload(fmt)}
                  className="text-xs"
                >
                  <Download className="size-4" />
                  {saving ? "保存中..." : fmt.toUpperCase()}
                </Button>
              ))}
            </div>

            {/* Barcode canvas */}
            <div
              ref={previewRef}
              className="rounded-md border border-dashed p-2 sm:p-3 -mx-2 sm:mx-0 overflow-x-auto"
            >
              <div className="inline-block min-w-full">
                {barcodeError ? (
                  <div className="flex items-center justify-center py-8 text-sm text-destructive">
                    条码渲染失败：{barcodeError}
                  </div>
                ) : customSvgString ? (
                  // Custom template: render the SVG directly
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(customSvgString)}`}
                    alt="Label preview"
                    className="max-w-full"
                  />
                ) : canvasPreview ? (
                  <PreviewTemplateCanvas
                    preview={canvasPreview}
                    expiryDisplay={toDisplayDate(previewMeta.expiryDate)}
                  />
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    条码生成中...
                  </div>
                )}
              </div>
            </div>

            {/* Metadata rows */}
            <div className="rounded-md bg-muted/50 p-2 text-sm">
              <p className="font-medium">HRI</p>
              <p className="break-all text-muted-foreground">{previewMeta.hri}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-sm">
              <p className="font-medium">GS1 Element String</p>
              <p className="break-all text-muted-foreground">{previewMeta.gs1Escaped}</p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}