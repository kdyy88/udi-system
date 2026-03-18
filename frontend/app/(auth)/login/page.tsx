"use client";

import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { motion, useAnimate } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/shared/PageTransition";
import { getAuthUser, setAuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { LoginResponse } from "@/types/udi";

// ── LocalStorage key for remembered credentials ──────────────────────────────
const REMEMBER_KEY = "gs1_udi_remember";

interface RememberedCreds {
  username: string;
  // password stored obfuscated (base64) — NOT real encryption, just masks
  // the value from casual shoulder-surfing in DevTools; the plaintext is
  // still recoverable from the browser. Users are warned via tooltip.
  pwd: string;
  remember: boolean;
}

function loadRemembered(): RememberedCreds | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RememberedCreds;
  } catch {
    return null;
  }
}

function saveRemembered(username: string, password: string): void {
  const data: RememberedCreds = {
    username,
    pwd: btoa(unescape(encodeURIComponent(password))),
    remember: true,
  };
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(data));
}

function clearRemembered(): void {
  localStorage.removeItem(REMEMBER_KEY);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type ErrorKind = "credentials" | "unverified" | "network" | null;

function errorMessage(kind: ErrorKind): string {
  if (kind === "credentials") return "用户名或密码错误";
  if (kind === "unverified") return "邮箱尚未验证，请查收激活邮件后再登录";
  if (kind === "network") return "网络连接异常，请检查网络后重试";
  return "";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "1";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [sectionRef, animate] = useAnimate();
  const formRef = useRef<HTMLFormElement>(null);

  // ── Auto-login / prefill on mount ───────────────────────────────────────────
  useEffect(() => {
    // Already logged in → skip login page
    if (getAuthUser()) {
      router.replace("/");
      return;
    }
    // Prefill remembered credentials
    const saved = loadRemembered();
    if (saved?.remember) {
      setUsername(saved.username);
      try {
        setPassword(decodeURIComponent(escape(atob(saved.pwd))));
      } catch {
        // corrupted — ignore
      }
      setRemember(true);
    }
  }, [router]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || success) return;

    setErrorKind(null);
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>("/api/v1/auth/login", {
        username,
        password,
      });

      // Persist or clear remembered credentials
      if (remember) {
        saveRemembered(username, password);
      } else {
        clearRemembered();
      }

      setAuthUser({
        user_id: response.data.user_id,
        username: response.data.username,
        email: response.data.email,
        role: response.data.role ?? "operator",
      });

      setSuccess(true);
      // Brief success display then navigate
      setTimeout(() => router.replace("/"), 900);
    } catch (err: unknown) {
      let kind: ErrorKind = "credentials";
      if (isAxiosError(err)) {
        if (err.response?.status === 403) kind = "unverified";
        else if (!err.response) kind = "network";
      }
      setErrorKind(kind);
      // Framer Motion shake sequence
      void animate(sectionRef.current, { x: [0, -8, 8, -5, 5, -2, 2, 0] }, { duration: 0.5, ease: "easeInOut" });
    } finally {
      setLoading(false);
    }
  };

  // ── Success overlay ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <PageTransition>
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-16 text-green-500" />
            <p className="text-lg font-semibold">登录成功</p>
            <p className="text-sm text-muted-foreground">正在跳转…</p>
          </div>
        </main>
      </PageTransition>
    );
  }

  // ── Login form ───────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <motion.section ref={sectionRef} className="w-full rounded-xl border p-6">
          <h1 className="text-2xl font-semibold">登录</h1>
          <p className="mt-2 text-sm text-muted-foreground">请先登录后再进行 UDI 操作。</p>

          {/* Verified banner */}
          {justVerified && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="size-4 shrink-0" />
              邮箱验证成功！请登录您的账号。
            </div>
          )}

          <form ref={formRef} className="mt-6 space-y-4" onSubmit={onSubmit} autoComplete="on">
            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="login-username" className="text-sm font-medium">用户名 / 邮箱</label>
              <Input
                id="login-username"
                autoComplete="username"
                name="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value.trim()); setErrorKind(null); }}
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">密码</label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                name="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorKind(null); }}
                disabled={loading}
                required
              />
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                className="size-4 accent-primary cursor-pointer"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="remember-me" className="text-sm select-none cursor-pointer">
                记住密码
              </label>
              <span
                className="ml-1 text-xs text-muted-foreground cursor-help"
                title="凭据将保存在本设备浏览器中。请勿在公共电脑上启用此功能。"
              >
                ⓘ
              </span>
            </div>

            {/* Inline error */}
            {errorKind && (
              <p className="text-sm text-destructive">
                {errorMessage(errorKind)}
                {errorKind === "unverified" && (
                  <> —{" "}
                    <Link href="/register" className="underline underline-offset-2">重新发送验证邮件</Link>
                  </>
                )}
              </p>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  登录中…
                </>
              ) : "登录"}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-sm">
            <Link href="/register" className="text-primary hover:underline">
              注册新账号
            </Link>
            <Link href="/forgot-password" className="text-muted-foreground hover:underline">
              忘记密码？
            </Link>
          </div>
        </motion.section>
      </main>
    </PageTransition>
  );
}
