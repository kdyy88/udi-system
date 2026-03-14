/**
 * Pure SVG label template generators — mirrors PreviewTemplateCanvas.tsx layouts.
 *
 * ⚠️  NO imports touching DOM, React, or Node.js APIs.
 *     Safe to import inside a Web Worker.
 *
 * Layout reference:
 *   compact — DataMatrix (left) + AI text lines (right)   → matches React "compact"
 *   dual    — DI GS1-128 (top) + PI GS1-128 (bottom)     → matches React "dual"
 *   detail  — metadata block + DataMatrix + GS1-128 + HRI → matches React "detail"
 */

export type LabelSvgInput = {
  gtin: string;
  hri: string;
  batch_no?: string | null;
  expiry_date?: string | null;
  serial_no?: string | null;
  production_date?: string | null;
  /** bwip-js toSVG() output for the GS1 DataMatrix (full HRI) */
  dataMatrixSvg: string;
  /** bwip-js toSVG() output for full GS1-128 (full HRI) */
  gs1128Svg: string | null;
  /** bwip-js toSVG() output for DI-only GS1-128: "(01){gtin}" */
  gs1128DiSvg: string | null;
  /** bwip-js toSVG() output for PI-only GS1-128: all AIs except (01) */
  gs1128PiSvg: string | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractSvgInner(svg: string): { inner: string; vw: number; vh: number } {
  const m = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  return {
    inner: svg.replace(/<\/?svg[^>]*>/g, ""),
    vw: m ? parseFloat(m[1]) : 100,
    vh: m ? parseFloat(m[2]) : 100,
  };
}

/** Scale + translate an SVG body to fit within (maxW × maxH), top-left at (ox, oy). */
function embedSvg(
  svg: string,
  ox: number,
  oy: number,
  maxW: number,
  maxH: number,
): { g: string; w: number; h: number } {
  const { inner, vw, vh } = extractSvgInner(svg);
  const scale = Math.min(maxW / vw, maxH / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { g: `<g transform="translate(${ox},${oy}) scale(${scale})">${inner}</g>`, w, h };
}

function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

function findAiValue(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)([^()]+)`))?.[1] ?? "";
}

// ─── compact ─────────────────────────────────────────────────────────────────
// Matches React compact: DataMatrix (left) + AI text column (right)

export function renderCompactSvg(input: LabelSvgInput): string {
  const PAD = 12;
  const DM_SIZE = 150;
  const W = 500;
  const H = 180;
  const GAP = 16;

  const { g: dmG } = embedSvg(input.dataMatrixSvg, PAD, (H - DM_SIZE) / 2, DM_SIZE, DM_SIZE);

  const textX = PAD + DM_SIZE + GAP;
  const lineH = 26;
  const fontSize = 17;

  const aiLines: string[] = [];
  for (const ai of ["01", "11", "17", "21", "10"]) {
    const v = findAiValue(input.hri, ai);
    if (v) aiLines.push(`(${ai})${escapeXml(v)}`);
  }

  const totalTextH = aiLines.length * lineH;
  const textStartY = (H - totalTextH) / 2 + fontSize;

  const textElems = aiLines
    .map(
      (line, i) =>
        `<text x="${textX}" y="${textStartY + i * lineH}" font-family="sans-serif" font-size="${fontSize}" font-weight="600" fill="#111">${line}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${dmG}
  ${textElems}
</svg>`;
}

// ─── dual ─────────────────────────────────────────────────────────────────────
// Matches React dual: DI GS1-128 + GTIN text + PI GS1-128 + PI text (stacked)

export function renderDualSvg(input: LabelSvgInput): string {
  const W = 660;
  const PAD = 20;
  const BAR_W = W - PAD * 2;
  const BAR_H = 72;
  const TEXT_H = 28;
  const GAP = 8;
  const H = PAD + BAR_H + TEXT_H + GAP + BAR_H + TEXT_H + PAD;

  const diHri = `(01)${input.gtin}`;
  const piParts = (["11", "17", "10", "21"] as const)
    .map((ai) => findAiText(input.hri, ai))
    .filter(Boolean);
  const piLine = piParts.join(" ");

  const diBarSrc = input.gs1128DiSvg ?? input.gs1128Svg;
  const piBarSrc = input.gs1128PiSvg ?? input.gs1128Svg;

  const diBarG = diBarSrc ? embedSvg(diBarSrc, PAD, PAD, BAR_W, BAR_H).g : "";
  const piBarG = piBarSrc
    ? embedSvg(piBarSrc, PAD, PAD + BAR_H + TEXT_H + GAP, BAR_W, BAR_H).g
    : "";

  const textY1 = PAD + BAR_H + 20;
  const textY2 = PAD + BAR_H + TEXT_H + GAP + BAR_H + 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${diBarG}
  <text x="${W / 2}" y="${textY1}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="600" fill="#111">${escapeXml(diHri)}</text>
  ${piBarG}
  <text x="${W / 2}" y="${textY2}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="600" fill="#111">${escapeXml(piLine)}</text>
</svg>`;
}

// ─── detail ───────────────────────────────────────────────────────────────────
// Matches React detail: metadata text (left) + DataMatrix + AI text (right) + full GS1-128 + HRI

export function renderDetailSvg(input: LabelSvgInput): string {
  const W = 780;
  const PAD = 16;
  const DM_SIZE = 100;
  const LINE_H = 22;
  const FONT = 15;
  const metaW = 220;
  const barMaxH = 56;

  const metaLines = [
    `生产批号：${input.batch_no ?? "-"}`,
    `生产日期：${input.production_date ?? "-"}`,
    `有效期至：${input.expiry_date ?? "-"}`,
  ];

  const aiLines: string[] = [];
  for (const ai of ["01", "11", "17", "10"]) {
    const v = findAiValue(input.hri, ai);
    if (v) aiLines.push(`(${ai})${escapeXml(v)}`);
  }

  const topH = Math.max(metaLines.length * LINE_H, DM_SIZE) + PAD;
  const H = PAD + topH + barMaxH + LINE_H + PAD * 2;

  const metaElems = metaLines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${PAD + FONT + i * LINE_H}" font-family="sans-serif" font-size="${FONT}" font-weight="600" fill="#111">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  const dmX = metaW + PAD;
  const { g: dmG } = embedSvg(input.dataMatrixSvg, dmX, PAD, DM_SIZE, DM_SIZE);

  const aiX = dmX + DM_SIZE + 12;
  const aiElems = aiLines
    .map(
      (line, i) =>
        `<text x="${aiX}" y="${PAD + FONT + i * LINE_H}" font-family="sans-serif" font-size="${FONT}" font-weight="600" fill="#111">${line}</text>`,
    )
    .join("\n  ");

  const barY = PAD + topH;
  const barG = input.gs1128Svg
    ? embedSvg(input.gs1128Svg, PAD, barY, W - PAD * 2, barMaxH).g
    : "";

  const hriY = barY + barMaxH + LINE_H;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${metaElems}
  ${dmG}
  ${aiElems}
  ${barG}
  <text x="${W / 2}" y="${hriY}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="#111">${escapeXml(input.hri)}</text>
</svg>`;
}
