"use client";

import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/labels/PageHeader";
import { LabelForm } from "@/components/labels/LabelForm";
import { HistoryTabs } from "@/components/labels/HistoryTabs";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { useLabels } from "@/hooks/useLabels";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function Home() {
  const [expiryDate, setExpiryDate] = useState("28/02/29");
  const { authUser, checkingAuth } = useRequireAuth();

  const queryClient = useQueryClient();
  const { previewSource, dialogOpen, setDialogOpen, handlePreviewLocally } =
    useLabels();

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

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PageHeader
        title="GS1 UDI 后台"
        description="录入 DI/PI，生成条码并持久化，支持历史筛选与重新查看。"
      />
      <LabelForm onSubmit={handleFormSubmit} />
      <HistoryTabs authUser={authUser} />
      <PreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        previewSource={previewSource}
        expiryDate={expiryDate}
        onSaved={() =>
          void queryClient.invalidateQueries({ queryKey: ["label-history", authUser.user_id] })
        }
      />
    </main>
  );
}

