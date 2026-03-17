"use client";

import { PageHeader } from "@/components/labels/PageHeader";
import { HistoryTabs } from "@/components/labels/HistoryTabs";
import { PageTransition } from "@/components/shared/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function HistoryPage() {
  const { authUser, checkingAuth } = useRequireAuth();

  if (checkingAuth || !authUser) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  return (
    <PageTransition>
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
      <PageHeader title="历史记录台账" titleClassName="text-2xl font-semibold" />

      <HistoryTabs authUser={authUser} />
    </main>
    </PageTransition>
  );
}
