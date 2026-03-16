"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="text-sm text-destructive">
        链接无效，请重新点击邮件中的重置链接。
      </p>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/v1/auth/reset-password", { token, password });
      toast.success("密码已重置，请重新登录");
      router.push("/login");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "重置失败，链接可能已过期");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label htmlFor="new-pwd" className="text-sm font-medium">新密码</label>
        <Input
          id="new-pwd"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-pwd" className="text-sm font-medium">确认新密码</label>
        <Input
          id="confirm-pwd"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "重置中..." : "重置密码"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">重置密码</h1>
        <p className="text-sm text-muted-foreground">请输入您的新密码（至少 8 位）。</p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">加载中…</p>}>
          <ResetPasswordContent />
        </Suspense>
        <p className="text-sm text-muted-foreground text-center">
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </section>
    </main>
  );
}
