"use client";

import { useRef } from "react";
import { Download, LayoutTemplate, Zap } from "lucide-react";
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
import type { LabelGenerateResponse, LabelPreviewResponse } from "@/types/udi";
import { useMemo, useState } from "react";
import {
  type PreviewBarcodeFormat,
  useLabelPreviewOrchestrator,
} from "@/features/labels/preview/useLabelPreviewOrchestrator";
import { exportPreviewNode, type PreviewExportFormat } from "@/features/labels/preview/export";

type PreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: LabelGenerateResponse | LabelPreviewResponse | null;
  expiryDate: string;
};

export function PreviewDialog({
  open,
  onOpenChange,
  preview,
  expiryDate,
}: PreviewDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [barcodeFormat, setBarcodeFormat] = useState<PreviewBarcodeFormat>("png");
  const { svgPreview, loadingSvg, previewForPng } = useLabelPreviewOrchestrator({
    preview,
    expiryDate,
    barcodeFormat,
    onSvgPreviewError: () => setBarcodeFormat("png"),
  });

  const selectedTemplate = useMemo(
    () => PREVIEW_TEMPLATES.find((item) => item.key === template),
    [template]
  );

  const loadingPng =
    barcodeFormat === "png" &&
    !!preview &&
    (!previewForPng?.datamatrix_base64 || !previewForPng?.gs1_128_base64);

  const previewMeta = useMemo(() => {
    if (!preview) {
      return null;
    }
    return [
      { label: "HRI", value: preview.hri },
      { label: "GS1 Element String", value: preview.gs1_element_string_escaped },
    ];
  }, [preview]);

  const handleDownload = async (format: PreviewExportFormat) => {
    if (!previewRef.current) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    try {
      await exportPreviewNode(previewRef.current, template, format);
    } catch {
      toast.error("下载失败，请重试");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>条码实时预览</DialogTitle>
          <DialogDescription>支持模板切换与下载：PDF / SVG / 透明背景 PNG</DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="mt-4 space-y-4">
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Zap className="size-4" />
                  条码
                </span>
                <Button
                  size="sm"
                  variant={barcodeFormat === "png" ? "default" : "outline"}
                  onClick={() => setBarcodeFormat("png")}
                  className="text-xs"
                >
                  PNG
                </Button>
                <Button
                  size="sm"
                  variant={barcodeFormat === "svg" ? "default" : "outline"}
                  onClick={() => setBarcodeFormat("svg")}
                  className="text-xs"
                >
                  SVG
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownload("png")}
                  className="text-xs"
                >
                  <Download className="size-4" /> PNG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownload("svg")}
                  className="text-xs"
                >
                  <Download className="size-4" /> SVG
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDownload("pdf")}
                  className="text-xs"
                >
                  <Download className="size-4" /> PDF
                </Button>
              </div>
            </div>

            {selectedTemplate ? (
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            ) : null}

            <div ref={previewRef} className="rounded-md border border-dashed p-2 sm:p-3 -mx-2 sm:mx-0 overflow-x-auto">
              <div className="inline-block min-w-full">
                {loadingSvg && barcodeFormat === "svg" ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    加载SVG中...
                  </div>
                ) : loadingPng ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    加载PNG中...
                  </div>
                ) : (
                  <PreviewTemplateCanvas
                    template={template}
                    preview={
                      barcodeFormat === "svg" && svgPreview
                        ? {
                            format: "svg",
                            data: {
                              hri: svgPreview.hri,
                              datamatrix_svg: svgPreview.datamatrix_svg,
                              gs1_128_svg: svgPreview.gs1_128_svg,
                              gs1_128_di_only_svg: svgPreview.gs1_128_di_only_svg,
                              gs1_128_pi_only_svg: svgPreview.gs1_128_pi_only_svg,
                            },
                          }
                        : {
                            format: "png",
                            data: previewForPng ?? preview,
                          }
                    }
                    expiryDisplay={toDisplayDate(expiryDate)}
                  />
                )}
              </div>
            </div>

            {previewMeta?.map((item) => (
              <div key={item.label} className="rounded-md bg-muted/50 p-2 text-sm">
                <p className="font-medium">{item.label}</p>
                <p className="break-all text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
