"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/types/udi";

type PageHeaderProps = {
  authUser: AuthUser | null;
};

export function PageHeader({ authUser }: PageHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearAuthUser();
    router.replace("/login");
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GS1 UDI 后台</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          录入 DI/PI，生成条码并持久化，支持历史筛选与重新查看。
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">当前用户：{authUser?.username}</span>
        <Button variant="outline" onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </header>
  );
}
