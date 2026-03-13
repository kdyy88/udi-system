/**
 * Frontend GS1 utility tests.
 *
 * These test cases intentionally mirror backend/tests/test_gs1_engine.py
 * so that any divergence between the two implementations is caught early.
 */

import { describe, it, expect } from "vitest";
import {
  calculateGs1CheckDigit,
  validateGtin14,
  buildHri,
  buildGs1ElementString,
  escapeGs1ElementString,
} from "../gs1";

const FNC1 = "\x1d";

// ─── calculateGs1CheckDigit ──────────────────────────────────────────────────

describe("calculateGs1CheckDigit", () => {
  it("returns '2' for 0950600013435 (mirrors backend test)", () => {
    expect(calculateGs1CheckDigit("0950600013435")).toBe("2");
  });

  it("returns '0' for all-zero body", () => {
    expect(calculateGs1CheckDigit("0000000000000")).toBe("0");
  });
});

// ─── validateGtin14 ──────────────────────────────────────────────────────────

describe("validateGtin14", () => {
  it("accepts a valid GTIN-14", () => {
    expect(validateGtin14("09506000134352")).toBe(true);
  });

  it("rejects wrong check digit", () => {
    expect(validateGtin14("09506000134353")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateGtin14("0950600013435X")).toBe(false);
  });

  it("rejects 13-digit input", () => {
    expect(validateGtin14("0950600013435")).toBe(false);
  });

  it("rejects 15-digit input", () => {
    expect(validateGtin14("095060001343520")).toBe(false);
  });
});

// ─── buildHri ─────────────────────────────────────────────────────────────────

describe("buildHri", () => {
  it("full 5-field HRI matches backend output", () => {
    const hri = buildHri({
      di: "09506000134352",
      lot: "LOT202603",
      expiry: "28/02/29",
      serial: "SN0001",
      productionDate: "16/01/01",
    });
    expect(hri).toBe(
      "(01)09506000134352(11)160101(17)280229(10)LOT202603(21)SN0001"
    );
  });

  it("minimal HRI with lot only", () => {
    const hri = buildHri({ di: "09506000134352", lot: "LOT001" });
    expect(hri).toBe("(01)09506000134352(10)LOT001");
    expect(hri).not.toContain("(17)");
    expect(hri).not.toContain("(21)");
  });

  it("AI order is 01 → 11 → 17 → 10 → 21", () => {
    const hri = buildHri({
      di: "09506000134352",
      lot: "L1",
      expiry: "26/12/31",
      serial: "S1",
      productionDate: "24/01/01",
    });
    const pos = (ai: string) => hri.indexOf(`(${ai})`);
    expect(pos("01")).toBeLessThan(pos("11"));
    expect(pos("11")).toBeLessThan(pos("17"));
    expect(pos("17")).toBeLessThan(pos("10"));
    expect(pos("10")).toBeLessThan(pos("21"));
  });

  it("normalises YY/MM/DD date", () => {
    const hri = buildHri({ di: "09506000134352", expiry: "29/02/28" });
    expect(hri).toContain("(17)290228");
  });

  it("normalises YYYY-MM-DD date", () => {
    const hri = buildHri({ di: "09506000134352", expiry: "2029-02-28" });
    expect(hri).toContain("(17)290228");
  });

  it("passes through YYMMDD date unchanged", () => {
    const hri = buildHri({ di: "09506000134352", expiry: "290228" });
    expect(hri).toContain("(17)290228");
  });
});

// ─── buildGs1ElementString ───────────────────────────────────────────────────

describe("buildGs1ElementString", () => {
  it("full build with FNC1 separators matches backend test", () => {
    const val = buildGs1ElementString({
      di: "09506000134352",
      lot: "LOT202603",
      expiry: "28/02/29",
      serial: "SN0001",
      productionDate: "16/01/01",
    });
    expect(val).toBe(
      `0109506000134352111601011728022910LOT202603${FNC1}21SN0001`
    );
  });

  it("last variable-length AI has no trailing FNC1", () => {
    const val = buildGs1ElementString({
      di: "09506000134352",
      lot: "LOT001",
    });
    expect(val).not.toMatch(/\x1d$/);
    expect(val).toBe("010950600013435210LOT001");
  });

  it("serial-only PI embeds correctly", () => {
    const val = buildGs1ElementString({
      di: "09506000134352",
      serial: "S001",
    });
    expect(val).toBe("010950600013435221S001");
  });

  it("returns only DI when all PI values are absent (no validation on frontend side)", () => {
    // Frontend does not throw – it builds what it has (DI only valid case)
    const val = buildGs1ElementString({ di: "09506000134352" });
    expect(val).toBe("0109506000134352");
  });
});

// ─── escapeGs1ElementString ──────────────────────────────────────────────────

describe("escapeGs1ElementString", () => {
  it("replaces FNC1 byte with \\x1d text", () => {
    const raw = `01123${FNC1}21XYZ`;
    expect(escapeGs1ElementString(raw)).toBe("01123\\x1d21XYZ");
  });

  it("is a no-op when no FNC1 present", () => {
    expect(escapeGs1ElementString("0112345678")).toBe("0112345678");
  });
});
