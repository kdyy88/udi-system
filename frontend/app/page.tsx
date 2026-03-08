"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/labels/PageHeader";
import { LabelForm } from "@/components/labels/LabelForm";
import { LabelHistorySection } from "@/components/labels/LabelHistorySection";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLabels } from "@/hooks/useLabels";
import { useLabelHistory } from "@/hooks/useLabelHistory";
import type { LabelHistoryItem, LabelPreviewResponse } from "@/types/udi";

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const { preview, setPreview, loadingGenerate, dialogOpen, setDialogOpen, handleGenerate } =
    useLabels();
  const {
    historyRows,
    loadingHistory,
    loadingReviewId,
    setLoadingReviewId,
    page,
    pageSize,
    total,
    fetchHistory,
    handleDelete,
  } = useLabelHistory();

  const [filterGtin, setFilterGtin] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("2028-02-29");

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (!checkingAuth && authUser) {
      void fetchHistory(1, filterGtin, filterBatchNo);
    }
  }, [authUser, checkingAuth, fetchHistory, filterGtin, filterBatchNo]);

  const handleFormSubmit = async (formData: {
    di: string;
    lot: string;
    expiryDate: string;
    serial: string;
    productionDate: string;
    remarks: string;
  }) => {
    const success = await handleGenerate(formData, authUser);
    if (success) {
      setExpiryDate(formData.expiryDate);
      await fetchHistory(1, filterGtin, filterBatchNo);
    }
    return success;
  };

  const handleReview = async (row: LabelHistoryItem) => {
    setLoadingReviewId(row.id);
    try {
      const response = await api.post<LabelPreviewResponse>("/api/v1/labels/preview", {
        di: row.gtin,
        lot: row.batch_no,
        expiry: row.expiry_date,
        serial: row.serial_no,
      });
      setPreview(response.data);
      setDialogOpen(true);
    } catch {
      toast.error("重新预览失败");
    } finally {
      setLoadingReviewId(null);
    }
  };

  const handleSearch = (gtin: string, batchNo: string) => {
    setFilterGtin(gtin);
    setFilterBatchNo(batchNo);
    void fetchHistory(1, gtin, batchNo);
  };

  const handleHistoryDelete = (id: number, onSuccess: () => void) => {
    void handleDelete(id, onSuccess);
  };

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PageHeader authUser={authUser} />
      <LabelForm onSubmit={handleFormSubmit} isLoading={loadingGenerate} />
      <LabelHistorySection
        rows={historyRows}
        loading={loadingHistory}
        loadingReviewId={loadingReviewId}
        page={page}
        pageSize={pageSize}
        total={total}
        onSearch={handleSearch}
        onReview={handleReview}
        onDelete={handleHistoryDelete}
        onPrev={() => void fetchHistory(page - 1, filterGtin, filterBatchNo)}
        onNext={() => void fetchHistory(page + 1, filterGtin, filterBatchNo)}
      />
      <PreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preview={preview}
        lot=""
        expiryDate={expiryDate}
      />
    </main>
  );
}
