/**
 * Client-side GS1 UDI utilities.
 * Mirrors the logic in backend/app/services/gs1_engine.py so the frontend
 * can build HRI / element strings without a round-trip to the backend.
 */

const FNC1_SEPARATOR = "\x1d";

/** Normalise a date value in YY/MM/DD, YYMMDD, or YYYY-MM-DD format → YYMMDD. */
function normalizeDate(value: string): string | null {
  if (!value) return null;
  const raw = value.trim();

  // YY/MM/DD
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
    return raw.replaceAll("/", "");
  }
  // YYMMDD
  if (/^\d{6}$/.test(raw)) {
    return raw;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split("-");
    return `${yyyy.slice(-2)}${mm}${dd}`;
  }
  return null;
}

/**
 * GS1 Mod-10 check digit for a 13-digit GTIN-14 body.
 * Matches the Python implementation in gs1_engine.py.
 */
export function calculateGs1CheckDigit(body13: string): string {
  let total = 0;
  for (let i = 0; i < 13; i++) {
    // Position from the right (1-indexed): rightmost = idx 1 → weight 3
    const weight = i % 2 === 0 ? 3 : 1; // reversed-iterate: i=0 is rightmost
    total += parseInt(body13[12 - i], 10) * weight;
  }
  return String((10 - (total % 10)) % 10);
}

/** Returns true when the 14-digit GTIN has a valid GS1 check digit. */
export function validateGtin14(di: string): boolean {
  if (!/^\d{14}$/.test(di)) return false;
  return di[13] === calculateGs1CheckDigit(di.slice(0, 13));
}

export type BuildGs1Params = {
  di: string;
  lot?: string | null;
  expiry?: string | null;
  serial?: string | null;
  productionDate?: string | null;
};

/**
 * Build a GS1 Human-Readable Interpretation string (with parenthesis AI notation).
 * Example: "(01)09506000134352(17)290228(10)LOT001(21)SN001"
 */
export function buildHri(params: BuildGs1Params): string {
  const { di, lot, expiry, serial, productionDate } = params;
  const parts: string[] = [`(01)${di}`];

  const pd = productionDate ? normalizeDate(productionDate) : null;
  if (pd) parts.push(`(11)${pd}`);

  const exp = expiry ? normalizeDate(expiry) : null;
  if (exp) parts.push(`(17)${exp}`);

  if (lot) parts.push(`(10)${lot}`);
  if (serial) parts.push(`(21)${serial}`);

  return parts.join("");
}

/**
 * Build a GS1 element string with AI prefixes and FNC1 separators for variable-length AIs.
 * This is the string encoded inside the DataMatrix barcode.
 */
export function buildGs1ElementString(params: BuildGs1Params): string {
  const { di, lot, expiry, serial, productionDate } = params;

  // Tuples: [ai, value, isVariableLength]
  const elements: Array<[string, string, boolean]> = [["01", di, false]];

  const pd = productionDate ? normalizeDate(productionDate) : null;
  if (pd) elements.push(["11", pd, false]);

  const exp = expiry ? normalizeDate(expiry) : null;
  if (exp) elements.push(["17", exp, false]);

  if (lot) elements.push(["10", lot, true]);
  if (serial) elements.push(["21", serial, true]);

  const parts: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const [ai, value, variable] = elements[i];
    parts.push(`${ai}${value}`);
    const hasNext = i < elements.length - 1;
    if (variable && hasNext) {
      parts.push(FNC1_SEPARATOR);
    }
  }
  return parts.join("");
}

/** Escape FNC1 characters for display purposes. */
export function escapeGs1ElementString(elementString: string): string {
  return elementString.replace(/\x1d/g, "\\x1d");
}
