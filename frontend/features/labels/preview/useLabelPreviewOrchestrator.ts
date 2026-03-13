/**
 * useBwipPreview — replaces the old server-round-trip orchestrator.
 *
 * All barcode SVGs are now generated synchronously in the browser via bwip-js.
 * No network requests are made here; the backend is only called when the user
 * explicitly exports a label (see save.ts).
 */
import { useMemo } from "react";

import { createDataMatrixSvg, createNormalizedGs1Svg } from "./barcode-svg";

export type BwipPreviewData = {
  datamatrixSvg: string | null;
  gs1128Svg: string | null;
  gs1128DiOnlySvg: string | null;
  gs1128PiOnlySvg: string | null;
  error: string | null;
};

function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

/**
 * Compute all four barcode SVGs from an HRI string.
 * Results are memoised: re-computation only happens when `hri` changes.
 */
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

    try {
      const diText = findAiText(hri, "01");
      const piParts = ["11", "17", "10", "21"]
        .map((ai) => findAiText(hri, ai))
        .filter(Boolean);
      const piText = piParts.join("");

      return {
        datamatrixSvg: createDataMatrixSvg(hri),
        gs1128Svg: createNormalizedGs1Svg(hri),
        gs1128DiOnlySvg: diText ? createNormalizedGs1Svg(diText) : null,
        gs1128PiOnlySvg: piText ? createNormalizedGs1Svg(piText) : null,
        error: null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "条码渲染失败";
      return {
        datamatrixSvg: null,
        gs1128Svg: null,
        gs1128DiOnlySvg: null,
        gs1128PiOnlySvg: null,
        error: message,
      };
    }
  }, [hri]);
}

