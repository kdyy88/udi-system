"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/shared/PageTransition";
import { getAuthUser, setAuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { LoginResponse } from "@/types/udi";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        email: response.data.email,
        role: response.data.role ?? "operator",
      });
      toast.success("登录成功");
      router.replace("/");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error("邮箱尚未验证，请查收激活邮件后再登录", { duration: 6000 });
      } else {
        toast.error("用户名或密码错误");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-xl border p-6">
        <h1 className="text-2xl font-semibold">登录</h1>
        <p className="mt-2 text-sm text-muted-foreground">请先登录后再进行 UDI 操作。</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} autoComplete="off">
          <div className="space-y-2">
            <label htmlFor="login-username" className="text-sm font-medium">用户名</label>
            <Input
              id="login-username"
              autoComplete="off"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium">密码</label>
            <Input
              id="login-password"
              type="password"
              autoComplete="new-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : "登录"}
          </Button>
        </form>



        <div className="mt-3 flex justify-between text-sm">
          <Link href="/register" className="text-primary hover:underline">
            注册新账号
          </Link>
          <Link href="/forgot-password" className="text-muted-foreground hover:underline">
            忘记密码？
          </Link>
        </div>
      </section>
    </main>
    </PageTransition>
  );
}
