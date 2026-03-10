"use client";

import { useRef, useEffect } from "react";
import { Download, LayoutTemplate, Zap } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
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
import { toDisplayDate, toTransferDate } from "@/lib/dateUtils";
import type { LabelGenerateResponse, LabelPreviewResponse, LabelPreviewSvgResponse } from "@/types/udi";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";

type PreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: LabelGenerateResponse | LabelPreviewResponse | null;
  expiryDate: string;
};

type BarcodeFormat = "png" | "svg";

// Helper to extract PI values from HRI string
// HRI format: (01)09506000134352(11)160101(17)280229(10)LOT202603(21)SN0001
function extractPIFromHRI(hri: string): {
  lot?: string;
  expiry?: string;
  serial?: string;
  productionDate?: string;
} {
  const result: { lot?: string; expiry?: string; serial?: string; productionDate?: string } = {};
  
  const matches = hri.matchAll(/\((\d+)\)([^()]+)/g);
  for (const match of matches) {
    const ai = match[1];
    const value = match[2];
    
    if (ai === "10") result.lot = value;
    else if (ai === "11") result.productionDate = value;
    else if (ai === "17") result.expiry = value;
    else if (ai === "21") result.serial = value;
  }
  
  return result;
}

function buildPreviewPayload(di: string, hri: string, expiryDate: string): Record<string, string> {
  const piValues = extractPIFromHRI(hri);
  const payload: Record<string, string> = { di };

  if (piValues.lot) payload.lot = piValues.lot;
  if (piValues.expiry) payload.expiry = toTransferDate(piValues.expiry) ?? piValues.expiry;
  if (piValues.productionDate) {
    payload.production_date = toTransferDate(piValues.productionDate) ?? piValues.productionDate;
  }
  if (piValues.serial) payload.serial = piValues.serial;

  if (!payload.expiry) {
    const normalizedExpiry = toTransferDate(expiryDate);
    if (normalizedExpiry) {
      payload.expiry = normalizedExpiry;
    }
  }

  return payload;
}

export function PreviewDialog({
  open,
  onOpenChange,
  preview,
  expiryDate,
}: PreviewDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("png");
  const [svgPreview, setSvgPreview] = useState<LabelPreviewSvgResponse | null>(null);
  const [pngEnhancedPreview, setPngEnhancedPreview] = useState<LabelPreviewResponse | null>(null);
  const [loadingSvg, setLoadingSvg] = useState(false);

  useEffect(() => {
    if (!preview) {
      return;
    }

    const needsEnhancedPng =
      !preview.gs1_128_di_only_base64 || !preview.gs1_128_pi_only_base64;

    if (!needsEnhancedPng || pngEnhancedPreview?.hri === preview.hri) {
      return;
    }

    const fetchEnhancedPngPreview = async () => {
      try {
        const payload = buildPreviewPayload(preview.di, preview.hri, expiryDate);
        const res = await api.post<LabelPreviewResponse>("/api/v1/labels/preview", payload);
        setPngEnhancedPreview(res.data);
      } catch {
        // keep fallback behavior with original preview data
      }
    };

    void fetchEnhancedPngPreview();
  }, [preview, pngEnhancedPreview, expiryDate]);

  // Fetch SVG preview when format is switched to SVG
  useEffect(() => {
    if (barcodeFormat !== "svg" || !preview) {
      return;
    }

    if (svgPreview?.hri === preview.hri) {
      return;
    }

    const fetchSvgPreview = async () => {
      setLoadingSvg(true);
      const payload = buildPreviewPayload(preview.di, preview.hri, expiryDate);

      try {
        const res = await api.post<LabelPreviewSvgResponse>("/api/v1/labels/preview-svg", payload);
        setSvgPreview(res.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("SVG preview error:", message);
        toast.error("加载SVG预览失败");
        setBarcodeFormat("png");
      } finally {
        setLoadingSvg(false);
      }
    };

    void fetchSvgPreview();
  }, [barcodeFormat, preview, svgPreview, expiryDate]);

  const selectedTemplate = useMemo(
    () => PREVIEW_TEMPLATES.find((item) => item.key === template),
    [template]
  );

  const previewMeta = useMemo(() => {
    if (!preview) {
      return null;
    }
    return [
      { label: "HRI", value: preview.hri },
      { label: "GS1 Element String", value: preview.gs1_element_string_escaped },
    ];
  }, [preview]);

  const downloadByDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handleDownload = async (format: "png" | "svg" | "pdf") => {
    if (!previewRef.current) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    try {
      if (format === "png") {
        const dataUrl = await toPng(previewRef.current, {
          backgroundColor: "transparent",
          pixelRatio: 2,
          cacheBust: true,
        });
        downloadByDataUrl(dataUrl, `udi-${template}.png`);
        return;
      }

      if (format === "svg") {
        const dataUrl = await toSvg(previewRef.current, {
          backgroundColor: "transparent",
          cacheBust: true,
        });
        downloadByDataUrl(dataUrl, `udi-${template}.svg`);
        return;
      }

      const pngDataUrl = await toPng(previewRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("load image failed"));
        image.src = pngDataUrl;
      });

      const pdf = new jsPDF({
        orientation: image.width > image.height ? "landscape" : "portrait",
        unit: "pt",
        format: [image.width, image.height],
      });
      pdf.addImage(pngDataUrl, "PNG", 0, 0, image.width, image.height);
      pdf.save(`udi-${template}.pdf`);
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
                            data:
                              pngEnhancedPreview?.hri === preview.hri
                                ? {
                                    ...preview,
                                    gs1_128_di_only_base64:
                                      pngEnhancedPreview.gs1_128_di_only_base64 ??
                                      preview.gs1_128_di_only_base64,
                                    gs1_128_pi_only_base64:
                                      pngEnhancedPreview.gs1_128_pi_only_base64 ??
                                      preview.gs1_128_pi_only_base64,
                                  }
                                : preview,
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
