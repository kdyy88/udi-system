"use client";

import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDataMatrixSvg,
  createNormalizedGs1Svg,
} from "@/features/labels/preview/barcode-svg";
import { buildHri } from "@/lib/gs1";
import { findAiText } from "@/lib/gs1Utils";
import { renderCustomSvg } from "@/lib/svgTemplates";
import type { ParsedRow } from "@/types/batch";
import type { CanvasDefinition } from "@/types/template";

type TemplatePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ParsedRow | null;
  templateDefinition: CanvasDefinition | null;
  templateName: string | null;
};

function buildSvgDataUrl(row: ParsedRow, templateDefinition: CanvasDefinition) {
  const hri = buildHri({
    di: row.di,
    lot: row.lot,
    expiry: row.expiry,
    serial: row.serial,
    productionDate: row.production_date,
  });

  const dataMatrixSvg = createDataMatrixSvg(hri);
  if (!dataMatrixSvg) {
    return null;
  }

  const gs1128Svg = createNormalizedGs1Svg(hri);
  const gs1128DiSvg = createNormalizedGs1Svg(`(01)${row.di}`);
  const piText = ["11", "17", "10", "21"]
    .map((ai) => findAiText(hri, ai))
    .filter(Boolean)
    .join("");
  const gs1128PiSvg = piText ? createNormalizedGs1Svg(piText) : null;

  const svg = renderCustomSvg(
    {
      gtin: row.di,
      hri,
      batch_no: row.lot,
      expiry_date: row.expiry,
      serial_no: row.serial,
      production_date: row.production_date,
      dataMatrixSvg,
      gs1128Svg,
      gs1128DiSvg,
      gs1128PiSvg,
    },
    templateDefinition,
  );

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  row,
  templateDefinition,
  templateName,
}: TemplatePreviewDialogProps) {
  const svgDataUrl = useMemo(() => {
    if (!row || !templateDefinition) {
      return null;
    }
    return buildSvgDataUrl(row, templateDefinition);
  }, [row, templateDefinition]);

  const dimensionText = useMemo(() => {
    if (!templateDefinition) {
      return null;
    }
    return `${Math.round(templateDefinition.widthPx / 3.78)} × ${Math.round(templateDefinition.heightPx / 3.78)} mm`;
  }, [templateDefinition]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{templateName ?? "模板预览"}</DialogTitle>
          <DialogDescription>
            基于第 1 行有效数据生成，用于放大查看当前模板
            {dimensionText ? ` · ${dimensionText}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-xl border border-dashed bg-muted/20 p-3 sm:p-4">
          <div className="overflow-auto rounded-lg border bg-white p-4 shadow-sm">
            {svgDataUrl ? (
              <div className="flex min-h-52 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={svgDataUrl} alt={`${templateName ?? "模板"}预览`} className="h-auto max-w-full" />
              </div>
            ) : (
              <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
                暂无可用预览，请先上传有效数据并选择模板
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
