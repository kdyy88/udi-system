import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { parseExcelFile } from "../excelParser";

async function createExcelFile(rows: Array<Array<string>>) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "UDI标签");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buffer], "batch.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseExcelFile", () => {
  it("normalizes YYYY-MM-DD dates to YYMMDD", async () => {
    const file = await createExcelFile([
      ["(01)DI/GTIN-14", "(10)批次号", "(17)有效期(格式YYMMDD)", "(21)序列号", "(11)生产日期(格式YYMMDD)", "备注"],
      ["09506000134383", "LOT001", "2026-02-03", "SN001", "2025-01-01", "ok"],
    ]);

    const rows = await parseExcelFile(file);

    expect(rows[0]?.validationError).toBeNull();
    expect(rows[0]?.expiry).toBe("260203");
    expect(rows[0]?.production_date).toBe("250101");
  });

  it("rejects unsupported YYYYMMDD dates", async () => {
    const file = await createExcelFile([
      ["(01)DI/GTIN-14", "(10)批次号", "(17)有效期(格式YYMMDD)", "(21)序列号", "(11)生产日期(格式YYMMDD)", "备注"],
      ["09506000134383", "LOT001", "20260203", "SN001", "250101", "bad date"],
    ]);

    const rows = await parseExcelFile(file);

    expect(rows[0]?.validationError).toBe(
      "有效期格式错误：请使用 YYMMDD、YY/MM/DD 或 YYYY-MM-DD",
    );
  });
});
