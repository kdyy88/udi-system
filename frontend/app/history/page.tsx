"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { HistoryTabs } from "@/components/labels/HistoryTabs";
import { clearAuthUser, getAuthUser, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">历史记录台账</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">当前用户：{authUser.username}</span>
          <Button
            variant="outline"
            onClick={() => {
              clearAuthUser();
              router.replace("/login");
            }}
          >
            退出登录
          </Button>
        </div>
      </div>

      <HistoryTabs authUser={authUser} />
    </main>
  );
}
