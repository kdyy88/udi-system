import type { LabelGenerateResponse, LabelPreviewResponse } from "@/types/udi";
import type { TemplateKey } from "@/lib/preview-templates";

type PreviewData = LabelGenerateResponse | LabelPreviewResponse;

type PreviewTemplateCanvasProps = {
  template: TemplateKey;
  preview: PreviewData;
  lot: string;
  expiryDisplay: string;
};

function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

export function PreviewTemplateCanvas({
  template,
  preview,
  lot,
  expiryDisplay,
}: PreviewTemplateCanvasProps) {
  if (template === "compact") {
    return (
      <div className="inline-flex items-start gap-4 bg-white p-2 text-black">
        <img
          src={`data:image/png;base64,${preview.datamatrix_base64}`}
          alt="DataMatrix"
          className="size-28"
        />
        <div className="space-y-1 text-base font-semibold leading-6">
          <p>{findAiText(preview.hri, "01")}</p>
          {findAiText(preview.hri, "17") ? <p>{findAiText(preview.hri, "17")}</p> : null}
          {findAiText(preview.hri, "10") ? <p>{findAiText(preview.hri, "10")}</p> : null}
          {findAiText(preview.hri, "21") ? <p>{findAiText(preview.hri, "21")}</p> : null}
        </div>
      </div>
    );
  }

  if (template === "dual") {
    return (
      <div className="inline-flex flex-col gap-3 bg-white p-3 text-black">
        <div className="flex items-start justify-between gap-3">
          <img
            src={`data:image/png;base64,${preview.gs1_128_base64}`}
            alt="GS1-128"
            className="h-12 w-[360px] object-contain"
          />
          <img
            src={`data:image/png;base64,${preview.datamatrix_base64}`}
            alt="DataMatrix"
            className="size-16"
          />
        </div>
        <p className="text-center text-xs font-semibold">{preview.hri}</p>
        <img
          src={`data:image/png;base64,${preview.gs1_128_base64}`}
          alt="GS1-128 duplicate"
          className="h-12 w-[460px] object-contain"
        />
        <p className="text-center text-xs font-semibold">{preview.hri.replace(/\(21\)[^()]+/, "")}</p>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-3 bg-white p-3 text-black">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm font-semibold">
          <p>生产批号：{lot || "-"}</p>
          <p>生产日期：{new Date().toISOString().slice(0, 10)}</p>
          <p>有效期至：{expiryDisplay}</p>
        </div>
        <div className="flex items-start gap-3">
          <img
            src={`data:image/png;base64,${preview.datamatrix_base64}`}
            alt="DataMatrix"
            className="size-20"
          />
          <div className="space-y-1 text-sm font-semibold leading-5">
            <p>{findAiText(preview.hri, "01")}</p>
            {findAiText(preview.hri, "17") ? <p>{findAiText(preview.hri, "17")}</p> : null}
            {findAiText(preview.hri, "10") ? <p>{findAiText(preview.hri, "10")}</p> : null}
          </div>
        </div>
      </div>
      <img
        src={`data:image/png;base64,${preview.gs1_128_base64}`}
        alt="GS1-128"
        className="h-14 w-[520px] object-contain"
      />
      <p className="text-center text-xs font-semibold">{preview.hri}</p>
    </div>
  );
}
