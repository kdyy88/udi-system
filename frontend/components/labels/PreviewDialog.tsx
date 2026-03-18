"use client";

import { useRef, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBwipPreview } from "@/features/labels/preview/useLabelPreviewOrchestrator";
import { exportPreviewNode, type PreviewExportFormat } from "@/features/labels/preview/export";
import { saveLabelToBackend } from "@/features/labels/preview/save";
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
  const savedPreviewSourceRef = useRef<PreviewSource | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const shouldLoadTemplateData = open && previewSource !== null;
  const { data: templateList } = useListTemplates({ enabled: shouldLoadTemplateData, fetchAll: true, pageSize: 50 });
  const templates = useMemo(() => templateList?.items ?? [], [templateList]);

  const { data: overridesData } = useSystemTemplateOverrides({ enabled: shouldLoadTemplateData });
  const effectiveSystemTemplates = applyOverrides(overridesData?.value ?? {});
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

  const { datamatrixSvg, gs1128Svg, gs1128DiOnlySvg, gs1128PiOnlySvg, error: barcodeError } = useBwipPreview(
    previewMeta?.hri
  );

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

  const selectedSystemTemplate = useMemo(
    () => effectiveSystemTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [effectiveSystemTemplates, selectedTemplateId],
  );

  const selectedUserTemplate = useMemo(
    () => templates.find((template) => String(template.id) === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  // Always produce an SVG so that what the user *sees* == what gets *exported*.
  // If a template is selected, use it; otherwise fall back to the compact
  // system template (sys-compact) so the preview is consistent with the export.
  const effectiveSvgString = useMemo(() => {
    if (!labelSvgInput) return null;
    if (selectedSystemTemplate) return renderCustomSvg(labelSvgInput, selectedSystemTemplate.canvas);
    if (selectedUserTemplate) return renderCustomSvg(labelSvgInput, recordToDefinition(selectedUserTemplate));
    // Default layout: use sys-compact (or first system template)
    const defaultCanvas =
      (effectiveSystemTemplates.find((t) => t.id === "sys-compact") ??
        effectiveSystemTemplates[0] ??
        SYSTEM_TEMPLATES[0]
      ).canvas;
    return renderCustomSvg(labelSvgInput, defaultCanvas);
  }, [labelSvgInput, selectedSystemTemplate, selectedUserTemplate, effectiveSystemTemplates]);

  const savePreviewIfNeeded = async () => {
    if (previewSource?.kind !== "local" || savedPreviewSourceRef.current === previewSource) {
      return true;
    }

    setSaving(true);
    try {
      await saveLabelToBackend(previewSource.data);
      savedPreviewSourceRef.current = previewSource;
      toast.success("已保存至历史记录");
      onSaved?.();
      return true;
    } catch {
      toast.error("保存失败，请检查网络后重试");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (format: PreviewExportFormat) => {
    if (!previewSource || !previewMeta) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    const saved = await savePreviewIfNeeded();
    if (!saved) {
      return;
    }

    if (effectiveSvgString && format === "svg") {
      const blob = new Blob([effectiveSvgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "udi-label.svg";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!previewRef.current) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    try {
      await exportPreviewNode(previewRef.current, "label", format);
    } catch {
      toast.error("下载失败，请重试");
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>条码实时预览</DialogTitle>
          <DialogDescription>
            {previewSource?.kind === "local"
              ? "首次下载将保存至历史记录，后续仅执行导出"
              : "历史记录预览 · 支持下载"}
          </DialogDescription>
        </DialogHeader>

        {previewSource && previewMeta ? (
          <div className="mt-4 space-y-4">
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

            {/* Preview canvas — always SVG so on-screen matches the exported file exactly */}
            <div className="rounded-md border border-dashed p-2 sm:p-3 -mx-2 sm:mx-0">
              <div ref={previewRef} className="flex justify-center">
                {barcodeError ? (
                  <div className="flex items-center justify-center py-8 text-sm text-destructive">
                    条码渲染失败：{barcodeError}
                  </div>
                ) : effectiveSvgString ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(effectiveSvgString)}`}
                    alt="Label preview"
                    className="max-w-full h-auto"
                  />
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    条码生成中...
                  </div>
                )}
              </div>
            </div>

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