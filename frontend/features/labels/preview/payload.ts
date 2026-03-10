import { toTransferDate } from "@/lib/dateUtils";

export type ParsedPiValues = {
  lot?: string;
  expiry?: string;
  serial?: string;
  productionDate?: string;
};

export function extractPIFromHRI(hri: string): ParsedPiValues {
  const result: ParsedPiValues = {};

  const matches = hri.matchAll(/\((\d+)\)([^()]+)/g);
  for (const match of matches) {
    const ai = match[1];
    const value = match[2];

    if (ai === "10") result.lot = value;
    else if (ai === "11") result.productionDate = value;
    else if (ai === "17") result.expiry = value;
    else if (ai === "21") result.serial = value;
  }

  return result;
}

export function buildPreviewPayload(di: string, hri: string, expiryDate: string): Record<string, string> {
  const piValues = extractPIFromHRI(hri);
  const payload: Record<string, string> = { di };

  if (piValues.lot) payload.lot = piValues.lot;
  if (piValues.expiry) payload.expiry = toTransferDate(piValues.expiry) ?? piValues.expiry;
  if (piValues.productionDate) {
    payload.production_date = toTransferDate(piValues.productionDate) ?? piValues.productionDate;
  }
  if (piValues.serial) payload.serial = piValues.serial;

  if (!payload.expiry) {
    const normalizedExpiry = toTransferDate(expiryDate);
    if (normalizedExpiry) {
      payload.expiry = normalizedExpiry;
    }
  }

  return payload;
}
