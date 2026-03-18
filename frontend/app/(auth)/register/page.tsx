"use client";

import { isAxiosError } from "axios";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type ErrorPayload = {
  detail?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/v1/auth/register", { email, username: username.trim() || null, password });
      setDone(true);
    } catch (err) {
      const detail = isAxiosError<ErrorPayload>(err) ? err.response?.data?.detail : undefined;
      toast.error(detail ?? "注册失败，请检查信息后重试");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <section className="w-full rounded-xl border p-6 space-y-4 text-center">
          <h1 className="text-2xl font-semibold">注册成功</h1>
          <p className="text-sm text-muted-foreground">
            一封验证邮件已发送至 <strong>{email}</strong>，请点击邮件中的链接完成账号激活。
          </p>
          <Button variant="outline" onClick={() => router.push("/login")}>
            返回登录
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">注册账号</h1>
        <p className="mt-2 text-sm text-muted-foreground">创建一个新账号以使用 UDI 系统。</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} autoComplete="on">
          <div className="space-y-2">
            <label htmlFor="reg-email" className="text-sm font-medium">邮箱</label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reg-username" className="text-sm font-medium">用户名（可选）</label>
            <Input
              id="reg-username"
              autoComplete="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              placeholder="留空则使用邮箱前缀"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="reg-password" className="text-sm font-medium">密码</label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground text-center">
          已有账号？{" "}
          <Link href="/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </section>
    </main>
  );
}
