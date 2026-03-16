"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      // fastapi-users accepts any email, always returns 202 regardless of existence (security)
      await api.post("/api/v1/auth/forgot-password", { email });
      setSent(true);
    } catch {
      toast.error("请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <section className="w-full rounded-xl border p-6 space-y-4 text-center">
          <h1 className="text-2xl font-semibold">邮件已发送</h1>
          <p className="text-sm text-muted-foreground">
            如果 <strong>{email}</strong> 存在于系统中，您将收到一封重置密码的邮件，请查收。
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            返回登录
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">忘记密码</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          输入您注册时使用的邮箱，我们将发送重置密码链接。
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label htmlFor="fp-email" className="text-sm font-medium">邮箱</label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "发送中..." : "发送重置链接"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground text-center">
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </section>
    </main>
  );
}
