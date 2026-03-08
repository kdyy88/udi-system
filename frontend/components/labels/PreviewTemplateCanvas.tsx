import type { LabelGenerateResponse, LabelPreviewResponse } from "@/types/udi";
import type { TemplateKey } from "@/lib/preview-templates";
import type { ReactNode } from "react";

type PreviewPngData = LabelGenerateResponse | LabelPreviewResponse;
type PreviewSvgData = {
  hri: string;
  datamatrix_svg: string;
  gs1_128_svg: string;
};

type PreviewData =
  | { format: "png"; data: PreviewPngData }
  | { format: "svg"; data: PreviewSvgData };

type BarcodeFormat = "png" | "svg";

type PreviewTemplateCanvasProps = {
  template: TemplateKey;
  preview: PreviewData;
  expiryDisplay: string;
};

function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

function renderBarcode(content: string, format: BarcodeFormat, className: string = ""): ReactNode {
  const src =
    format === "svg"
      ? `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
      : `data:image/png;base64,${content}`;

  if (className) {
    return <img src={src} alt="Barcode" className={className} />;
  }
  return <img src={src} alt="Barcode" />;
}

function getBarcodePayload(preview: PreviewData) {
  if (preview.format === "svg") {
    return {
      hri: preview.data.hri,
      datamatrix: preview.data.datamatrix_svg,
      gs1_128: preview.data.gs1_128_svg,
      format: "svg" as const,
    };
  }

  return {
    hri: preview.data.hri,
    datamatrix: preview.data.datamatrix_base64,
    gs1_128: preview.data.gs1_128_base64,
    format: "png" as const,
  };
}

export function PreviewTemplateCanvas({
  template,
  preview,
  expiryDisplay,
}: PreviewTemplateCanvasProps) {
  const payload = getBarcodePayload(preview);

  if (template === "compact") {
    return (
      <div className="inline-flex items-start gap-4 bg-white p-2 text-black">
        {renderBarcode(payload.datamatrix, payload.format, "size-28")}
        <div className="space-y-1 text-base font-semibold leading-6">
          <p>{findAiText(payload.hri, "01")}</p>
          {findAiText(payload.hri, "17") ? <p>{findAiText(payload.hri, "17")}</p> : null}
          {findAiText(payload.hri, "10") ? <p>{findAiText(payload.hri, "10")}</p> : null}
          {findAiText(payload.hri, "21") ? <p>{findAiText(payload.hri, "21")}</p> : null}
        </div>
      </div>
    );
  }

  if (template === "dual") {
    return (
      <div className="flex flex-col gap-3 bg-white p-3 text-black">
        <div className="flex items-start justify-between gap-3 overflow-x-auto">
          {renderBarcode(payload.gs1_128, payload.format, "h-12 w-auto max-w-xs shrink-0 object-contain md:max-w-sm")}
          {renderBarcode(payload.datamatrix, payload.format, "size-16 shrink-0")}
        </div>
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{payload.hri}</p>
        {renderBarcode(payload.gs1_128, payload.format, "h-12 w-auto max-w-xs shrink-0 object-contain md:max-w-md")}
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{payload.hri.replace(/\(21\)[^()]+/, "")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-3 text-black">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm font-semibold">
          <p>生产批号：{findAiText(payload.hri, "10") || "-"}</p>
          <p>生产日期：{new Date().toISOString().slice(0, 10)}</p>
          <p>有效期至：{expiryDisplay}</p>
        </div>
        <div className="flex items-start gap-3 overflow-x-auto py-1">
          {renderBarcode(payload.datamatrix, payload.format, "size-20 shrink-0")}
          <div className="space-y-1 text-sm font-semibold leading-5 shrink-0">
            <p>{findAiText(payload.hri, "01")}</p>
            {findAiText(payload.hri, "17") ? <p>{findAiText(payload.hri, "17")}</p> : null}
            {findAiText(payload.hri, "10") ? <p>{findAiText(payload.hri, "10")}</p> : null}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {renderBarcode(payload.gs1_128, payload.format, "h-14 w-auto max-w-full object-contain")}
      </div>
      <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{payload.hri}</p>
    </div>
  );
}
