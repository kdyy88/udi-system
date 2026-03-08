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
      <div className="flex flex-col gap-3 bg-white p-3 text-black">
        <div className="flex items-start justify-between gap-3 overflow-x-auto">
          <img
            src={`data:image/png;base64,${preview.gs1_128_base64}`}
            alt="GS1-128"
            className="h-12 w-auto max-w-xs shrink-0 object-contain md:max-w-sm"
          />
          <img
            src={`data:image/png;base64,${preview.datamatrix_base64}`}
            alt="DataMatrix"
            className="size-16 shrink-0"
          />
        </div>
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{preview.hri}</p>
        <img
          src={`data:image/png;base64,${preview.gs1_128_base64}`}
          alt="GS1-128 duplicate"
          className="h-12 w-auto max-w-xs shrink-0 object-contain md:max-w-md"
        />
        <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{preview.hri.replace(/\(21\)[^()]+/, "")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-white p-3 text-black">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm font-semibold">
          <p>生产批号：{lot || "-"}</p>
          <p>生产日期：{new Date().toISOString().slice(0, 10)}</p>
          <p>有效期至：{expiryDisplay}</p>
        </div>
        <div className="flex items-start gap-3 overflow-x-auto py-1">
          <img
            src={`data:image/png;base64,${preview.datamatrix_base64}`}
            alt="DataMatrix"
            className="size-20 shrink-0"
          />
          <div className="space-y-1 text-sm font-semibold leading-5 shrink-0">
            <p>{findAiText(preview.hri, "01")}</p>
            {findAiText(preview.hri, "17") ? <p>{findAiText(preview.hri, "17")}</p> : null}
            {findAiText(preview.hri, "10") ? <p>{findAiText(preview.hri, "10")}</p> : null}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <img
          src={`data:image/png;base64,${preview.gs1_128_base64}`}
          alt="GS1-128"
          className="h-14 w-auto max-w-full object-contain"
        />
      </div>
      <p className="text-center text-xs font-semibold overflow-x-auto pb-1">{preview.hri}</p>
    </div>
  );
}
