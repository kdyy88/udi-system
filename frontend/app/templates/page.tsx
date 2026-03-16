"use client";

import { PageHeader } from "@/components/labels/PageHeader";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { isAdmin } from "@/lib/auth";

export default function TemplatesPage() {
  const { authUser, checkingAuth } = useRequireAuth();

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="标签模板"
        description="管理系统默认模板和您的自定义模板"
        titleClassName="text-2xl font-semibold"
      />
      <TemplateGallery mode="manage" isAdmin={isAdmin(authUser)} />
    </main>
  );
}
