"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateGallery } from "@/components/editor/TemplateGallery";
import { getAuthUser, isAdmin, type AuthUser } from "@/lib/auth";

export default function TemplatesPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.replace("/login"); return; }
    setAuthUser(user);
  }, [router]);

  if (!authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">标签模板</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理系统默认模板和您的自定义模板
        </p>
      </div>
      <TemplateGallery userId={authUser.user_id} mode="manage" isAdmin={isAdmin(authUser)} />
    </main>
  );
}
