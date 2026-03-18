import { useMemo } from "react";

import { createDataMatrixSvg, createNormalizedGs1Svg } from "./barcode-svg";
import { findAiText } from "@/lib/gs1Utils";

export type BwipPreviewData = {
  datamatrixSvg: string | null;
  gs1128Svg: string | null;
  gs1128DiOnlySvg: string | null;
  gs1128PiOnlySvg: string | null;
  error: string | null;
};

export function useBwipPreview(hri: string | null | undefined): BwipPreviewData {
  return useMemo<BwipPreviewData>(() => {
    if (!hri) {
      return {
        datamatrixSvg: null,
        gs1128Svg: null,
        gs1128DiOnlySvg: null,
        gs1128PiOnlySvg: null,
        error: null,
      };
    }

    const diText = findAiText(hri, "01");
    const piText = ["11", "17", "10", "21"]
      .map((ai) => findAiText(hri, ai))
      .filter(Boolean)
      .join("");

    return {
      datamatrixSvg: createDataMatrixSvg(hri),
      gs1128Svg: createNormalizedGs1Svg(hri),
      gs1128DiOnlySvg: diText ? createNormalizedGs1Svg(diText) : null,
      gs1128PiOnlySvg: piText ? createNormalizedGs1Svg(piText) : null,
      error: null,
    };
  }, [hri]);
}

