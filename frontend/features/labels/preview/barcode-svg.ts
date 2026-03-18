import bwipjs from "@bwip-js/browser";

export const DUAL_BARCODE_WIDTH = 320;
export const DUAL_BARCODE_HEIGHT = 48;

// ─── Generic bwip-js helper ───────────────────────────────────────────────────

function makeSvg(options: Parameters<typeof bwipjs.toSVG>[0]): string | null {
  try {
    return bwipjs.toSVG(options);
  } catch {
    return null;
  }
}

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
  return makeSvg({ ...BWIP_GS1_128_OPTIONS, text: hriText });
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
  return makeSvg({ ...BWIP_GS1_DATAMATRIX_OPTIONS, text: hriText });
}

// ─── Additional barcode types ─────────────────────────────────────────────────

/**
 * Render a QR Code as an SVG string.
 * @param text - Arbitrary text to encode.
 */
export function createQrSvg(text: string): string | null {
  return makeSvg({
    bcid: "qrcode",
    text,
    scale: 3,
    includetext: false,
  });
}

/**
 * Render an Aztec Code as an SVG string.
 * @param text - Arbitrary text to encode.
 */
export function createAztecSvg(text: string): string | null {
  return makeSvg({
    bcid: "azteccode",
    text,
    scale: 3,
    includetext: false,
  });
}

/**
 * Render an EAN-13 barcode as an SVG string (normalised, no whitespace padding).
 * @param text - 13-digit numeric string (or 12 digits + check-digit auto-computed).
 */
export function createEan13Svg(text: string): string | null {
  const raw = makeSvg({
    bcid: "ean13",
    text,
    scale: 2,
    includetext: true,
    textxalign: "center",
    height: 20,
    paddingwidth: 0,
    paddingheight: 0,
  });
  return raw ? normalizeLinearSvg(raw) : null;
}

/**
 * Render an EAN-8 barcode as an SVG string.
 * @param text - 8-digit numeric string.
 */
export function createEan8Svg(text: string): string | null {
  const raw = makeSvg({
    bcid: "ean8",
    text,
    scale: 2,
    includetext: true,
    textxalign: "center",
    height: 18,
    paddingwidth: 0,
    paddingheight: 0,
  });
  return raw ? normalizeLinearSvg(raw) : null;
}

/**
 * Render a Code 128 barcode as an SVG string.
 * @param text - Arbitrary ASCII text to encode.
 */
export function createCode128Svg(text: string): string | null {
  const raw = makeSvg({
    bcid: "code128",
    text,
    scale: 2,
    includetext: false,
    height: 10,
    paddingwidth: 0,
    paddingheight: 0,
  });
  return raw ? normalizeLinearSvg(raw) : null;
}

