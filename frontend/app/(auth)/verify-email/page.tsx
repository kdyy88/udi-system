"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { setAuthUser } from "@/lib/auth";
import type { LoginResponse } from "@/types/udi";

const REMEMBER_KEY = "gs1_udi_remember";

type Status = "verifying" | "auto-logging-in" | "success" | "error" | "missing";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "missing");

  useEffect(() => {
    if (!token) return;

    api.post("/api/v1/auth/verify", { token })
      .then(async () => {
        // Try auto-login with remembered credentials
        try {
          const raw = localStorage.getItem(REMEMBER_KEY);
          if (raw) {
            const saved = JSON.parse(raw) as { username: string; pwd: string; remember: boolean };
            const password = decodeURIComponent(escape(atob(saved.pwd)));
            setStatus("auto-logging-in");

            const res = await api.post<LoginResponse>("/api/v1/auth/login", {
              username: saved.username,
              password,
            });
            setAuthUser({
              user_id: res.data.user_id,
              username: res.data.username,
              email: res.data.email,
              role: res.data.role ?? "operator",
            });
            setStatus("success");
            setTimeout(() => router.replace("/"), 800);
            return;
          }
        } catch {
          // auto-login failed — fall through to manual login redirect
        }

        // No remembered creds or auto-login failed → go to login with banner
        router.replace("/login?verified=1");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [token, router]);

  if (status === "missing") {
    return (
      <p className="text-sm text-destructive">
        链接无效，请重新点击邮件中的验证链接。
      </p>
    );
  }
  if (status === "verifying") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在验证邮箱…
      </div>
    );
  }
  if (status === "auto-logging-in") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        验证成功，正在自动登录…
      </div>
    );
  }
  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <p className="text-sm font-medium">登录成功，正在跳转…</p>
      </div>
    );
  }
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-destructive">
        验证失败，链接可能已过期或已使用。
      </p>
      <Link href="/login" className="text-sm text-primary hover:underline">
        返回登录
      </Link>
    </div>
  );
}

import { Suspense } from "react";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">邮箱验证</h1>
        <Suspense fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中…
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </section>
    </main>
  );
}

