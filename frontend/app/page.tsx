"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/labels/PageHeader";
import { LabelForm } from "@/components/labels/LabelForm";
import { HistoryTabs } from "@/components/labels/HistoryTabs";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { useLabels } from "@/hooks/useLabels";

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [expiryDate, setExpiryDate] = useState("28/02/29");

  const queryClient = useQueryClient();
  const { previewSource, dialogOpen, setDialogOpen, handlePreviewLocally } =
    useLabels();

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

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <PageHeader authUser={authUser} />
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

