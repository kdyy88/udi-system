/**
 * Excel template parser for batch UDI label upload.
 *
 * Expected column headers in the first row (case-insensitive, trimmed):
 *   GTIN-14 / gtin / di          → di          (required)
 *   批次号 / lot / batch          → lot
 *   有效期 / expiry / 到期日       → expiry
 *   序列号 / serial               → serial
 *   生产日期 / production_date    → production_date
 *   备注 / remarks                → remarks
 *
 * If headers are not found, falls back to positional mapping:
 *   A=GTIN-14, B=lot, C=expiry, D=serial, E=production_date, F=remarks
 */

import * as XLSX from "xlsx";
import type { ParsedRow } from "@/types/batch";

const COLUMN_MAP: Record<string, keyof Omit<ParsedRow, "rowIndex" | "validationError">> = {
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

    const validationError = validateGtin(di);

    rows.push({
      rowIndex: r,
      di,
      lot: raw.lot ?? null,
      expiry: raw.expiry ?? null,
      serial: raw.serial ?? null,
      production_date: raw.production_date ?? null,
      remarks: raw.remarks ?? null,
      validationError,
    });
  }

  if (rows.length === 0) throw new Error("未找到有效数据行（GTIN-14 列为空）");
  if (rows.length > 500) throw new Error(`数据行数超出限制（最多 500 行，当前 ${rows.length} 行）`);

  return rows;
}
