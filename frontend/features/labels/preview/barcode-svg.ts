import bwipjs from "@bwip-js/browser";

export const DUAL_BARCODE_WIDTH = 320;
export const DUAL_BARCODE_HEIGHT = 48;

const BWIP_GS1_128_OPTIONS = {
  bcid: "gs1-128",
  includetext: false,
  height: 10,
  scaleX: 2,
  scaleY: 2,
  paddingwidth: 0,
  paddingheight: 0,
} as const;

const BWIP_GS1_DATAMATRIX_OPTIONS = {
  bcid: "gs1datamatrix",
  scale: 3,
  includetext: false,
} as const;

function toGs1SvgWithBwip(hriText: string): string | null {
  try {
    return bwipjs.toSVG({
      ...BWIP_GS1_128_OPTIONS,
      text: hriText,
    });
  } catch {
    return null;
  }
}

function normalizeLinearSvg(svg: string): string {
  const pathMatch = svg.match(/<path[^>]*stroke-width="([0-9.]+)"[^>]*d="([^"]+)"[^>]*>/);
  if (!pathMatch) return svg;

  const strokeWidth = Number(pathMatch[1]) || 0;
  const d = pathMatch[2];
  const pointPattern = /([ML])\s*([0-9.]+)\s*([0-9.]+)/g;

  const points: Array<{ cmd: string; x: number; y: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(d)) !== null) {
    points.push({ cmd: match[1], x: Number(match[2]), y: Number(match[3]) });
  }

  if (points.length === 0) return svg;

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const pad = strokeWidth / 2;
  const shiftX = minX - pad;
  const newWidth = Math.max(1, maxX - minX + strokeWidth);

  const normalizedD = d.replace(pointPattern, (_, cmd: string, x: string, y: string) => {
    const newX = Number(x) - shiftX;
    return `${cmd}${newX} ${y}`;
  });

  const viewBoxMatch = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  if (!viewBoxMatch) {
    return svg
      .replace(d, normalizedD)
      .replace("<svg ", '<svg preserveAspectRatio="none" ');
  }

  const height = Number(viewBoxMatch[2]);
  return svg
    .replace(pathMatch[2], normalizedD)
    .replace(viewBoxMatch[0], `viewBox="0 0 ${newWidth} ${height}"`)
    .replace("<svg ", '<svg preserveAspectRatio="none" ');
}

/** Render a GS1-128 barcode as a compact, normalised SVG string (bwip-js). */
export function createNormalizedGs1Svg(hriText: string): string | null {
  const raw = toGs1SvgWithBwip(hriText);
  if (!raw) return null;
  return normalizeLinearSvg(raw);
}

/**
 * Render a GS1 DataMatrix barcode as an SVG string (bwip-js).
 * @param hriText - Full HRI string e.g. "(01)09506…(17)290228(10)LOT001"
 */
export function createDataMatrixSvg(hriText: string): string | null {
  try {
    return bwipjs.toSVG({
      ...BWIP_GS1_DATAMATRIX_OPTIONS,
      text: hriText,
    });
  } catch {
    return null;
  }
}

