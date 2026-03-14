"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthUser, setAuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { LoginResponse } from "@/types/udi";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAuthUser()) {
      router.replace("/");
    }
  }, [router]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post<LoginResponse>("/api/v1/auth/login", {
        username,
        password,
      });

      setAuthUser({
        user_id: response.data.user_id,
        username: response.data.username,
        role: response.data.role ?? "operator",
      });
      toast.success("登录成功");
      router.replace("/");
    } catch {
      toast.error("用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">登录</h1>
        <p className="mt-2 text-sm text-muted-foreground">请先登录后再进行 UDI 操作。</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">用户名</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          演示账号：demo / demo123，admin / admin123456
        </p>
      </section>
    </main>
  );
}
