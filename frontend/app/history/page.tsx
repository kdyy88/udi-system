"use client";

import { PageHeader } from "@/components/labels/PageHeader";
import { HistoryTabs } from "@/components/labels/HistoryTabs";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function HistoryPage() {
  const { authUser, checkingAuth } = useRequireAuth();

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
      <PageHeader title="历史记录台账" titleClassName="text-2xl font-semibold" />

      <HistoryTabs authUser={authUser} />
    </main>
  );
}
