"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Status = "verifying" | "success" | "error" | "missing";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "verifying" : "missing");

  useEffect(() => {
    if (!token) return;

    api
      .post("/api/v1/auth/verify", { token })
      .then(() => {
        setStatus("success");
        toast.success("邮箱验证成功，请登录");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [token]);

  if (status === "missing") {
    return (
      <p className="text-sm text-destructive">
        链接无效，请重新点击邮件中的验证链接。
      </p>
    );
  }
  if (status === "verifying") {
    return <p className="text-sm text-muted-foreground">正在验证…</p>;
  }
  if (status === "success") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">您的邮箱已验证成功，现在可以登录了。</p>
        <Button onClick={() => router.push("/login")}>前往登录</Button>
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
        <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
          <VerifyEmailContent />
        </Suspense>
      </section>
    </main>
  );
}
