"use client";

import { PageHeader } from "@/components/labels/PageHeader";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import { PageTransition } from "@/components/shared/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { isAdmin } from "@/lib/auth";

export default function TemplatesPage() {
  const { authUser, checkingAuth } = useRequireAuth();

  if (checkingAuth || !authUser) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="h-7 w-32 mb-6" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <PageTransition>
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="标签模板"
        description="管理系统默认模板和您的自定义模板"
        titleClassName="text-2xl font-semibold"
      />
      <TemplateGallery mode="manage" isAdmin={isAdmin(authUser)} />
    </main>
    </PageTransition>
  );
}
