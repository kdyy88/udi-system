/**
 * Excel template parser for batch UDI label upload.
 *
 * Expected column headers in the first row (case-insensitive, trimmed):
 *   Standard (new):  (01)DI/GTIN-14 / (10)批次号 / (17)有效期(格式YYMMDD) / (21)序列号 / (11)生产日期(格式YYMMDD) / 备注
 *   Legacy aliases:  GTIN-14 / gtin / di  |  批次号 / lot  |  有效期 / expiry  |  序列号 / serial  |  生产日期
 *
 * If headers are not found, falls back to positional mapping:
 *   A=(01)DI/GTIN-14, B=(10)批次号, C=(17)有效期, D=(21)序列号, E=(11)生产日期, F=备注
 */

import * as XLSX from "xlsx";
import type { ParsedRow } from "@/types/batch";

const COLUMN_MAP: Record<string, keyof Omit<ParsedRow, "rowIndex" | "validationError">> = {
  // ── Standard headers (with GS1 AI prefix) ───────────────────────────
  "(01)di/gtin-14": "di",
  "(10)批次号": "lot",
  "(17)有效期(格式yymmdd)": "expiry",
  "(21)序列号": "serial",
  "(11)生产日期(格式yymmdd)": "production_date",

  // ── Legacy / alias headers (backward compat) ────────────────────────
  "gtin-14": "di",
  gtin: "di",
  di: "di",

  批次号: "lot",
  lot: "lot",
  batch: "lot",
  "batch/lot": "lot",

  有效期: "expiry",
  expiry: "expiry",
  到期日: "expiry",
  "expiry date": "expiry",

  序列号: "serial",
  serial: "serial",
  "serial no": "serial",
  "serial number": "serial",

  生产日期: "production_date",
  production_date: "production_date",
  proddate: "production_date",
  "production date": "production_date",

  备注: "remarks",
  remarks: "remarks",
  note: "remarks",
  备注信息: "remarks",
};

const POSITIONAL_FIELDS: Array<keyof Omit<ParsedRow, "rowIndex" | "validationError">> = [
  "di",
  "lot",
  "expiry",
  "serial",
  "production_date",
  "remarks",
];

function cellToString(cell: XLSX.CellObject | undefined): string | null {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return null;
  // Prefer the formatted text (cell.w) so numeric cells like GTINs keep leading
  // zeros (e.g. Excel stores 09506000134383 as number 9506000134383, but cell.w
  // preserves the original text when cellText:true is set).
  const text = (cell.w ?? String(cell.v)).trim();
  return text || null;
}

function detectColumnMapping(
  sheet: XLSX.WorkSheet,
  firstRow: number,
): Map<number, keyof Omit<ParsedRow, "rowIndex" | "validationError">> | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const colMap = new Map<number, keyof Omit<ParsedRow, "rowIndex" | "validationError">>();

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: firstRow, c });
    const raw = cellToString(sheet[cellAddr]);
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
    const fieldName = COLUMN_MAP[key];
    if (fieldName) colMap.set(c, fieldName);
  }

  // Only accept header detection if we found the mandatory 'di' column
  return [...colMap.values()].includes("di") ? colMap : null;
}

/** GS1 Mod-10 check digit — mirrors backend ensure_valid_gtin14 */
function calcCheckDigit(body: string): string {
  let total = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(body[12 - i], 10);
    total += digit * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (total % 10)) % 10);
}

function validateGtin(gtin: string): string | null {
  if (!/^\d{14}$/.test(gtin))
    return gtin.length !== 14
      ? `GTIN-14 长度必须为14位，当前: ${gtin.length}位`
      : "GTIN-14 必须全为数字";
  const expected = calcCheckDigit(gtin.slice(0, 13));
  if (gtin[13] !== expected)
    return `GTIN-14 校验位错误（末位应为 ${expected}，实际为 ${gtin[13]}）`;
  return null;
}

function validatePiPresence(raw: {
  lot?: string | null;
  expiry?: string | null;
  serial?: string | null;
  production_date?: string | null;
}): string | null {
  if (raw.lot || raw.expiry || raw.serial || raw.production_date) {
    return null;
  }
  return "至少需要填写一个 PI：批次号、有效期、序列号或生产日期";
}

function normalizeGs1Date(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(raw)) {
    const [yy, mm, dd] = raw.split("/");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
      return null;
    }
    return `${yy}${mm}${dd}`;
  }

  if (/^\d{6}$/.test(raw)) {
    const mm = Number(raw.slice(2, 4));
    const dd = Number(raw.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      return null;
    }
    return raw;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split("-");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
      return null;
    }
    return `${yyyy.slice(-2)}${mm}${dd}`;
  }

  return null;
}

function validateAndNormalizeDate(
  value: string | null | undefined,
  fieldLabel: string,
): { normalized: string | null; error: string | null } {
  if (!value) {
    return { normalized: null, error: null };
  }

  const normalized = normalizeGs1Date(value);
  if (!normalized) {
    return {
      normalized: null,
      error: `${fieldLabel}格式错误：请使用 YYMMDD、YY/MM/DD 或 YYYY-MM-DD`,
    };
  }

  return { normalized, error: null };
}

export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 文件不包含任何工作表");

  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");

  // Try to detect headers from row 0 (0-based)
  const colMap = detectColumnMapping(sheet, range.s.r);
  const hasHeaders = colMap !== null;
  const dataStartRow = hasHeaders ? range.s.r + 1 : range.s.r;

  const rows: ParsedRow[] = [];

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const raw: Partial<Record<keyof Omit<ParsedRow, "rowIndex" | "validationError">, string | null>> = {};

    if (hasHeaders && colMap) {
      colMap.forEach((fieldName, colIndex) => {
        const cellAddr = XLSX.utils.encode_cell({ r, c: colIndex });
        raw[fieldName] = cellToString(sheet[cellAddr]);
      });
    } else {
      // Positional fallback
      POSITIONAL_FIELDS.forEach((fieldName, i) => {
        const colIndex = range.s.c + i;
        const cellAddr = XLSX.utils.encode_cell({ r, c: colIndex });
        raw[fieldName] = cellToString(sheet[cellAddr]);
      });
    }

    const di = raw.di ?? "";
    if (!di) continue; // skip empty rows

    const expiryResult = validateAndNormalizeDate(raw.expiry, "有效期");
    const productionDateResult = validateAndNormalizeDate(raw.production_date, "生产日期");

    const normalizedRaw = {
      ...raw,
      expiry: expiryResult.normalized,
      production_date: productionDateResult.normalized,
    };

    const validationError =
      validateGtin(di) ??
      expiryResult.error ??
      productionDateResult.error ??
      validatePiPresence(normalizedRaw);

    rows.push({
      rowIndex: r,
      di,
      lot: raw.lot ?? null,
      expiry: expiryResult.normalized,
      serial: raw.serial ?? null,
      production_date: productionDateResult.normalized,
      remarks: raw.remarks ?? null,
      validationError,
    });
  }

  if (rows.length === 0) throw new Error("未找到有效数据行（GTIN-14 列为空）");
  if (rows.length > 500) throw new Error(`数据行数超出限制（最多 500 行，当前 ${rows.length} 行）`);

  return rows;
}
