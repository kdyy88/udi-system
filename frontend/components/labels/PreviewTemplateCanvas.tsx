import type { LabelGenerateResponse, LabelPreviewResponse } from "@/types/udi";
import type { TemplateKey } from "@/lib/preview-templates";
import type { ReactNode } from "react";
import { toDisplayDate } from "@/lib/dateUtils";
import {
  createNormalizedGs1Svg,
  DUAL_BARCODE_HEIGHT,
  DUAL_BARCODE_WIDTH,
} from "@/features/labels/preview/barcode-svg";

type PreviewPngData = LabelGenerateResponse | LabelPreviewResponse;
type PreviewSvgData = {
  hri: string;
  datamatrix_svg: string;
  gs1_128_svg: string;
  gs1_128_di_only_svg?: string | null;
  gs1_128_pi_only_svg?: string | null;
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

function findAiValue(hri: string, ai: string): string | undefined {
  const matched = hri.match(new RegExp(`\\(${ai}\\)([^()]+)`));
  return matched?.[1];
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

function barcodeSrc(content: string, format: BarcodeFormat): string {
  return format === "svg"
    ? `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
    : `data:image/png;base64,${content}`;
}

function getBarcodePayload(preview: PreviewData) {
  if (preview.format === "svg") {
    return {
      hri: preview.data.hri,
      datamatrix: preview.data.datamatrix_svg,
      gs1_128: preview.data.gs1_128_svg,
      gs1_128_di_only: preview.data.gs1_128_di_only_svg,
      gs1_128_pi_only: preview.data.gs1_128_pi_only_svg,
      format: "svg" as const,
    };
  }

  return {
    hri: preview.data.hri,
    datamatrix: preview.data.datamatrix_base64,
    gs1_128: preview.data.gs1_128_base64,
    gs1_128_di_only: preview.data.gs1_128_di_only_base64,
    gs1_128_pi_only: preview.data.gs1_128_pi_only_base64,
    format: "png" as const,
  };
}

export function PreviewTemplateCanvas({
  template,
  preview,
  expiryDisplay,
}: PreviewTemplateCanvasProps) {
  const payload = getBarcodePayload(preview);
  const productionDisplay = toDisplayDate(findAiValue(payload.hri, "11"));
  const expiryDisplayFromHri = toDisplayDate(findAiValue(payload.hri, "17"));
  const finalExpiryDisplay = expiryDisplayFromHri !== "-" ? expiryDisplayFromHri : expiryDisplay;

  if (template === "compact") {
    return (
      <div className="inline-flex items-start gap-4 bg-white p-2 text-black">
        {renderBarcode(payload.datamatrix, payload.format, "size-34")}
        <div className="space-y-1 text-base font-semibold leading-6">
          <p>{findAiText(payload.hri, "01")}</p>
          {findAiText(payload.hri, "11") ? <p>{findAiText(payload.hri, "11")}</p> : null}
          {findAiText(payload.hri, "17") ? <p>{findAiText(payload.hri, "17")}</p> : null}
          {findAiText(payload.hri, "21") ? <p>{findAiText(payload.hri, "21")}</p> : null}
          {findAiText(payload.hri, "10") ? <p>{findAiText(payload.hri, "10")}</p> : null}
        </div>
      </div>
    );
  }

  if (template === "dual") {
    const diText = findAiText(payload.hri, "01");
    const diValue = findAiValue(payload.hri, "01") ?? "-";
    const piParts = [findAiText(payload.hri, "11"), findAiText(payload.hri, "17"), findAiText(payload.hri, "10")]
      .filter(Boolean);
    const piLine = piParts
      .filter(Boolean)
      .join(" ");
    const diBarcode = payload.gs1_128_di_only || payload.gs1_128;
    const piBarcode = payload.gs1_128_pi_only || payload.gs1_128;
    const bwipDiSvg = payload.format === "svg" && diText ? createNormalizedGs1Svg(diText) : null;
    const bwipPiSvg =
      payload.format === "svg" && piParts.length > 0
        ? createNormalizedGs1Svg(piParts.join(""))
        : null;
    const finalDiBarcode = payload.format === "svg" && bwipDiSvg ? bwipDiSvg : diBarcode;
    const finalPiBarcode = payload.format === "svg" && bwipPiSvg ? bwipPiSvg : piBarcode;
    const diBarcodeSrc = barcodeSrc(finalDiBarcode, payload.format);
    const piBarcodeSrc = barcodeSrc(finalPiBarcode, payload.format);

    return (
      <div className="flex flex-col gap-1 bg-white p-1 text-black">
        <div className="flex items-start justify-center gap-1 overflow-x-auto">
          <img
            src={diBarcodeSrc}
            alt="DI Barcode"
            className="shrink-0"
            style={{ width: DUAL_BARCODE_WIDTH, maxWidth: "100%", height: DUAL_BARCODE_HEIGHT, objectFit: "fill", display: "block" }}
          />
        </div>
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">(01) {diValue}</p>
        <div className="flex items-start justify-center overflow-x-auto">
          <img
            src={piBarcodeSrc}
            alt="PI Barcode"
            className="shrink-0"
            style={{ width: DUAL_BARCODE_WIDTH, maxWidth: "100%", height: DUAL_BARCODE_HEIGHT, objectFit: "fill", display: "block" }}
          />
        </div>
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{piLine || "-"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-3 text-black">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm font-semibold">
          <p>生产批号：{findAiText(payload.hri, "10") || "-"}</p>
          <p>生产日期：{productionDisplay}</p>
          <p>有效期至：{finalExpiryDisplay}</p>
        </div>
        <div className="flex items-start gap-3 overflow-x-auto py-1">
          {renderBarcode(payload.datamatrix, payload.format, "size-20 shrink-0")}
          <div className="space-y-1 text-sm font-semibold leading-5 shrink-0">
            <p>{findAiText(payload.hri, "01")}</p>
            {findAiText(payload.hri, "11") ? <p>{findAiText(payload.hri, "11")}</p> : null}
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
