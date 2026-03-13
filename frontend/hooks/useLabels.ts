"use client";

import { useState } from "react";
import { toast } from "sonner";

import { toTransferDate } from "@/lib/dateUtils";
import {
  buildHri,
  buildGs1ElementString,
  escapeGs1ElementString,
  validateGtin14,
} from "@/lib/gs1";
import type { PreviewSource } from "@/types/udi";

type LabelFormData = {
  di: string;
  lot: string;
  expiryDate: string;
  serial: string;
  productionDate: string;
  remarks: string;
};

export function useLabels() {
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  /**
   * Build a local preview from form data — no network call.
   * Opens the preview dialog immediately (instant, no spinner needed).
   */
  const handlePreviewLocally = (formData: LabelFormData): boolean => {
    if (formData.di.length !== 14 || !validateGtin14(formData.di)) {
      toast.error("DI 必须是有效的 14 位 GTIN（含正确校验位）");
      return false;
    }

    const params = {
      di: formData.di,
      lot: formData.lot || null,
      expiry: toTransferDate(formData.expiryDate) ?? null,
      serial: formData.serial || null,
      productionDate: toTransferDate(formData.productionDate) ?? null,
    };

    try {
      const hri = buildHri(params);
      const gs1 = buildGs1ElementString(params);

      setPreviewSource({
        kind: "local",
        data: {
          di: formData.di,
          hri,
          gs1_element_string: gs1,
          gs1_element_string_escaped: escapeGs1ElementString(gs1),
          lot: params.lot,
          expiry: params.expiry,
          serial: params.serial,
          productionDate: params.productionDate,
          remarks: formData.remarks || null,
        },
      });
      setDialogOpen(true);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GS1 字符串构建失败");
      return false;
    }
  };

  return {
    previewSource,
    setPreviewSource,
    dialogOpen,
    setDialogOpen,
    handlePreviewLocally,
  };
}

