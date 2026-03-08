"use client";

import { useRef } from "react";
import { Download, LayoutTemplate } from "lucide-react";
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
import { toDisplayDate } from "@/lib/dateUtils";
import type { LabelGenerateResponse, LabelPreviewResponse } from "@/types/udi";
import { useMemo, useState } from "react";

type PreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: LabelGenerateResponse | LabelPreviewResponse | null;
  lot: string;
  expiryDate: string;
};

export function PreviewDialog({
  open,
  onOpenChange,
  preview,
  lot,
  expiryDate,
}: PreviewDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);

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
                <PreviewTemplateCanvas
                  template={template}
                  preview={preview}
                  lot={lot}
                  expiryDisplay={toDisplayDate(
                    expiryDate.split("-").length === 3
                      ? `${expiryDate.split("-")[0].slice(-2)}${expiryDate.split("-")[1]}${expiryDate.split("-")[2]}`
                      : undefined
                  )}
                />
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
