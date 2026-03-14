import type { ReactNode } from "react";
import { toDisplayDate } from "@/lib/dateUtils";
import {
  createNormalizedGs1Svg,
  DUAL_BARCODE_HEIGHT,
  DUAL_BARCODE_WIDTH,
} from "@/features/labels/preview/barcode-svg";
import { findAiText, findAiValue } from "@/lib/gs1Utils";

/** Shape of data when using backend-rendered PNG barcodes (legacy / fallback path). */
type PreviewPngData = {
  hri: string;
  datamatrix_base64: string;
  gs1_128_base64: string;
  gs1_128_di_only_base64?: string | null;
  gs1_128_pi_only_base64?: string | null;
};
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

/**
 * Generic label preview — compact layout (DataMatrix left + AI text right).
 * Template selection is handled in the editor; this component is for history/dialog previews only.
 */
export type PreviewTemplateCanvasProps = {
  preview: PreviewData;
  expiryDisplay: string;
};

function renderBarcode(content: string, format: BarcodeFormat, className: string = ""): ReactNode {
  const src =
    format === "svg"
      ? `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
      : `data:image/png;base64,${content}`;

  if (className) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Barcode" className={className} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
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
  preview,
  expiryDisplay,
}: PreviewTemplateCanvasProps) {
  const payload = getBarcodePayload(preview);
  const productionDisplay = toDisplayDate(findAiValue(payload.hri, "11"));
  const expiryDisplayFromHri = toDisplayDate(findAiValue(payload.hri, "17"));
  const finalExpiryDisplay = expiryDisplayFromHri !== "-" ? expiryDisplayFromHri : expiryDisplay;

  // Compact layout: DataMatrix left + AI text right
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
