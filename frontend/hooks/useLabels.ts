import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { toTransferDate } from "@/lib/dateUtils";
import { LABELS_API_ROUTES } from "@/features/labels/api/routes";
import type {
  LabelGenerateResponse,
  LabelPreviewResponse,
  AuthUser,
} from "@/types/udi";

type LabelFormData = {
  di: string;
  lot: string;
  expiryDate: string;
  serial: string;
  productionDate: string;
  remarks: string;
};

export function useLabels() {
  const [preview, setPreview] = useState<LabelGenerateResponse | LabelPreviewResponse | null>(
    null
  );
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleGenerate = async (formData: LabelFormData, authUser: AuthUser | null) => {
    if (!authUser) {
      toast.error("请先登录");
      return false;
    }

    if (formData.di.length !== 14) {
      toast.error("DI 必须是 14 位 GTIN");
      return false;
    }

    setLoadingGenerate(true);
    try {
      const generateRes = await api.post<LabelGenerateResponse>(
        LABELS_API_ROUTES.generate,
        {
          user_id: authUser.user_id,
          di: formData.di,
          lot: formData.lot || null,
          expiry: toTransferDate(formData.expiryDate) ?? null,
          serial: formData.serial || null,
          production_date: toTransferDate(formData.productionDate) ?? null,
          remarks: formData.remarks || null,
        }
      );

      setPreview(generateRes.data);
      setDialogOpen(true);
      toast.success("生成成功，已入库");
      return true;
    } catch {
      toast.error("生成失败，请检查 DI/PI 参数");
      return false;
    } finally {
      setLoadingGenerate(false);
    }
  };

  return {
    preview,
    setPreview,
    loadingGenerate,
    dialogOpen,
    setDialogOpen,
    handleGenerate,
  };
}
