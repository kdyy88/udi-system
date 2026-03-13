"use client";

import { useRef, useMemo, useState } from "react";
import { Download, LayoutTemplate } from "lucide-react";
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
import {
  DEFAULT_TEMPLATE_KEY,
  PREVIEW_TEMPLATES,
  type TemplateKey,
} from "@/lib/preview-templates";
import { toDisplayDate } from "@/lib/dateUtils";
import { useBwipPreview } from "@/features/labels/preview/useLabelPreviewOrchestrator";
import { exportPreviewNode, type PreviewExportFormat } from "@/features/labels/preview/export";
import { saveLabelToBackend } from "@/features/labels/preview/save";
import { getAuthUser } from "@/lib/auth";
import type { PreviewSource } from "@/types/udi";

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
  const [template, setTemplate] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [saving, setSaving] = useState(false);

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

  const selectedTemplate = useMemo(
    () => PREVIEW_TEMPLATES.find((item) => item.key === template),
    [template]
  );

  const handleDownload = async (format: PreviewExportFormat) => {
    if (!previewRef.current || !previewSource || !previewMeta) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    // Brand-new label: save to backend before downloading
    if (previewSource.kind === "local") {
      const authUser = getAuthUser();
      if (!authUser) {
        toast.error("请先登录");
        return;
      }
      setSaving(true);
      try {
        await saveLabelToBackend(previewSource.data, authUser.user_id);
        toast.success("已保存至历史记录");
        onSaved?.();
      } catch {
        toast.error("保存失败，请检查网络后重试");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    try {
      await exportPreviewNode(previewRef.current, template, format);
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
              : "历史记录预览 · 支持模板切换与下载"}
          </DialogDescription>
        </DialogHeader>

        {previewSource && previewMeta ? (
          <div className="mt-4 space-y-4">
            {/* Template switcher */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <LayoutTemplate className="size-4" />
                  模板
                </span>
                {PREVIEW_TEMPLATES.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={template === item.key ? "default" : "outline"}
                    onClick={() => setTemplate(item.key)}
                    className="text-xs"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {/* Download buttons */}
              <div className="flex flex-wrap items-center gap-2">
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
            </div>

            {selectedTemplate ? (
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            ) : null}

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
                ) : canvasPreview ? (
                  <PreviewTemplateCanvas
                    template={template}
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


