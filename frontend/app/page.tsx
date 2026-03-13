"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/labels/PageHeader";
import { LabelForm } from "@/components/labels/LabelForm";
import { LabelHistorySection } from "@/components/labels/LabelHistorySection";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { useLabels } from "@/hooks/useLabels";
import { useLabelHistory } from "@/hooks/useLabelHistory";
import type { LabelHistoryItem } from "@/types/udi";

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [expiryDate, setExpiryDate] = useState("28/02/29");

  const { previewSource, setPreviewSource, dialogOpen, setDialogOpen, handlePreviewLocally } =
    useLabels();

  const {
    historyRows,
    loadingHistory,
    total,
    hasPrev,
    hasNext,
    handleSearch,
    handleDelete,
    invalidateHistory,
    goToPrevPage,
    goToNextPage,
  } = useLabelHistory();

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthUser(user);
    setCheckingAuth(false);
  }, [router]);

  const handleFormSubmit = (formData: {
    di: string;
    lot: string;
    expiryDate: string;
    serial: string;
    productionDate: string;
    remarks: string;
  }): boolean => {
    const success = handlePreviewLocally(formData);
    if (success) {
      setExpiryDate(formData.expiryDate);
    }
    return success;
  };

  const handleReview = (row: LabelHistoryItem) => {
    // Instant — no API call, bwip-js renders from hri in the dialog
    setExpiryDate(row.expiry_date ?? "");
    setPreviewSource({ kind: "history", data: row });
    setDialogOpen(true);
  };

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PageHeader authUser={authUser} />
      <LabelForm onSubmit={handleFormSubmit} />
      <LabelHistorySection
        rows={historyRows}
        loading={loadingHistory}
        total={total}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onSearch={handleSearch}
        onReview={handleReview}
        onDelete={handleDelete}
        onPrev={goToPrevPage}
        onNext={goToNextPage}
      />
      <PreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        previewSource={previewSource}
        expiryDate={expiryDate}
        onSaved={invalidateHistory}
      />
    </main>
  );
}

