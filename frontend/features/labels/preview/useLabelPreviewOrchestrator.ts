import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type {
  LabelGenerateResponse,
  LabelPreviewResponse,
  LabelPreviewSvgResponse,
} from "@/types/udi";
import { LABELS_API_ROUTES } from "@/features/labels/api/routes";
import { buildPreviewPayload } from "@/features/labels/preview/payload";

export type PreviewBarcodeFormat = "png" | "svg";

type UseLabelPreviewOrchestratorParams = {
  preview: LabelGenerateResponse | LabelPreviewResponse | null;
  expiryDate: string;
  barcodeFormat: PreviewBarcodeFormat;
  onSvgPreviewError: () => void;
};

export function useLabelPreviewOrchestrator({
  preview,
  expiryDate,
  barcodeFormat,
  onSvgPreviewError,
}: UseLabelPreviewOrchestratorParams) {
  const [svgPreview, setSvgPreview] = useState<LabelPreviewSvgResponse | null>(null);
  const [pngEnhancedPreview, setPngEnhancedPreview] = useState<LabelPreviewResponse | null>(null);
  const [loadingSvg, setLoadingSvg] = useState(false);

  useEffect(() => {
    if (!preview) {
      return;
    }

    const needsEnhancedPng =
      !preview.datamatrix_base64 ||
      !preview.gs1_128_base64 ||
      !preview.gs1_128_di_only_base64 ||
      !preview.gs1_128_pi_only_base64;

    if (!needsEnhancedPng || pngEnhancedPreview?.hri === preview.hri) {
      return;
    }

    const fetchEnhancedPngPreview = async () => {
      try {
        const payload = buildPreviewPayload(preview.di, preview.hri, expiryDate);
        const res = await api.post<LabelPreviewResponse>(LABELS_API_ROUTES.preview, payload);
        setPngEnhancedPreview(res.data);
      } catch {
        // keep fallback behavior with original preview data
      }
    };

    void fetchEnhancedPngPreview();
  }, [preview, pngEnhancedPreview, expiryDate]);

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
        const res = await api.post<LabelPreviewSvgResponse>(LABELS_API_ROUTES.previewSvg, payload);
        setSvgPreview(res.data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "unknown error";
        console.error("SVG preview error:", message);
        toast.error("加载SVG预览失败");
        onSvgPreviewError();
      } finally {
        setLoadingSvg(false);
      }
    };

    void fetchSvgPreview();
  }, [barcodeFormat, preview, svgPreview, expiryDate, onSvgPreviewError]);

  const previewForPng =
    preview && pngEnhancedPreview?.hri === preview.hri
      ? {
          ...preview,
          datamatrix_base64: pngEnhancedPreview.datamatrix_base64,
          gs1_128_base64: pngEnhancedPreview.gs1_128_base64,
          gs1_128_di_only_base64:
            pngEnhancedPreview.gs1_128_di_only_base64 ?? preview.gs1_128_di_only_base64,
          gs1_128_pi_only_base64:
            pngEnhancedPreview.gs1_128_pi_only_base64 ?? preview.gs1_128_pi_only_base64,
        }
      : preview;

  return {
    svgPreview,
    loadingSvg,
    previewForPng,
  };
}
