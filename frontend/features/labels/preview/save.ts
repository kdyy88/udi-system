/**
 * saveLabelToBackend — called once per export to persist UDI metadata.
 *
 * The backend no longer renders barcode images; it just stores the UDI
 * fields and returns the created history record ID + GS1 strings.
 */
import { api } from "@/lib/api";
import { LABELS_API_ROUTES } from "@/features/labels/api/routes";
import type { LocalPreviewData, LabelSaveResponse } from "@/types/udi";

export async function saveLabelToBackend(
  preview: LocalPreviewData,
  userId: number
): Promise<LabelSaveResponse> {
  const { data } = await api.post<LabelSaveResponse>(LABELS_API_ROUTES.generate, {
    user_id: userId,
    di: preview.di,
    lot: preview.lot ?? null,
    expiry: preview.expiry ?? null,
    serial: preview.serial ?? null,
    production_date: preview.productionDate ?? null,
    remarks: preview.remarks ?? null,
  });
  return data;
}
