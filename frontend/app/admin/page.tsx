"use client";

import { isAxiosError } from "axios";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  useAdminHealth,
  useAdminStats,
  useAdminUsers,
  type AdminUserSummary,
} from "@/hooks/useAdmin";

const ENABLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

type Tab = "users" | "stats" | "health";

type ApiErrorPayload = {
  detail?: string;
};

function getErrorDetail(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.detail ?? fallback;
  }
  return fallback;
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "用户管理" },
    { id: "stats", label: "数据看板" },
    { id: "health", label: "系统健康" },
  ];
  return (
    <div className="flex gap-1 border-b pb-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-t-md border-b-2 px-5 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function UsersTab({ currentAdminId }: { currentAdminId: string }) {
  const { users, totalUsers, loadingUsers, updateUser, deleteUser } = useAdminUsers();
  const [deleteTarget, setDeleteTarget] = useState<AdminUserSummary | null>(null);

  const handleToggleActive = (user: AdminUserSummary) => {
    updateUser.mutate(
      { userId: user.id, payload: { is_active: !user.is_active } },
      {
        onSuccess: () =>
          toast.success(`账号已${user.is_active ? "禁用" : "启用"}：${user.username ?? user.email}`),
        onError: (error) =>
          toast.error(getErrorDetail(error, "操作失败")),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`账号已删除：${deleteTarget.username ?? deleteTarget.email}`);
        setDeleteTarget(null);
      },
      onError: (error) =>
        toast.error(getErrorDetail(error, "删除失败")),
    });
  };

  if (loadingUsers) {
    return <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>;
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 <span className="font-medium text-foreground">{totalUsers}</span> 个账户
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">用户名</th>
              <th className="px-4 py-2.5 font-medium">邮箱</th>
              <th className="px-4 py-2.5 font-medium">角色</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">注册时间</th>
              <th className="px-4 py-2.5 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = String(user.id) === currentAdminId;
              return (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{user.username ?? "—"}</span>
                    {isSelf && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        当前账号
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        user.role === "admin"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {user.role === "admin" ? "管理员" : "操作员"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-xs",
                        user.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
                      )}
                    >
                      {user.is_active ? (
                        <UserCheck className="size-3" />
                      ) : (
                        <UserX className="size-3" />
                      )}
                      {user.is_active ? "启用" : "已禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || updateUser.isPending}
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.is_active ? "禁用" : "启用"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || deleteUser.isPending}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              确认删除账号
            </DialogTitle>
            <DialogDescription>
              此操作不可撤销。将永久删除账号{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.username ?? deleteTarget?.email}
              </span>{" "}
              及其所有登录信息（标签历史数据不受影响）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={handleDelete}
            >
              {deleteUser.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatsTab() {
  const { stats, loadingStats, refetchStats, statsUpdatedAt } = useAdminStats();

  const cards = [
    {
      label: "累计生成标签",
      value: stats?.total_labels ?? 0,
      icon: <Activity className="size-5 text-primary" />,
      color: "bg-primary/5",
    },
    {
      label: "今日新增记录",
      value: stats?.today_labels ?? 0,
      icon: <Activity className="size-5 text-green-600" />,
      color: "bg-green-50 dark:bg-green-950/20",
    },
    {
      label: "历史批次总数",
      value: stats?.total_batches ?? 0,
      icon: <Database className="size-5 text-blue-500" />,
      color: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      label: "注册用户数",
      value: stats?.total_users ?? 0,
      icon: <Server className="size-5 text-violet-500" />,
      color: "bg-violet-50 dark:bg-violet-950/20",
    },
    {
      label: "近30天活跃用户",
      value: stats?.active_users ?? 0,
      icon: <Server className="size-5 text-amber-500" />,
      color: "bg-amber-50 dark:bg-amber-950/20",
    },
  ];

  const lastUpdated = statsUpdatedAt
    ? new Date(statsUpdatedAt).toLocaleTimeString("zh-CN")
    : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lastUpdated ? `上次更新：${lastUpdated}（60秒自动刷新）` : "基于 label_history / label_batch 表实时聚合"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetchStats()} disabled={loadingStats}>
          <RefreshCw className={cn("size-3.5 mr-1", loadingStats && "animate-spin")} />
          手动刷新
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-5",
              card.color,
            )}
          >
            {card.icon}
            <p className="text-3xl font-bold">
              {loadingStats ? "—" : card.value.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusLight({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="size-5 shrink-0 text-green-500" />
  ) : (
    <XCircle className="size-5 shrink-0 text-destructive" />
  );
}

function HealthTab() {
  const { health, loadingHealth, refetchHealth } = useAdminHealth();

  const services = [
    { name: "PostgreSQL 数据库", key: "database" as const },
    { name: "Redis 缓存", key: "redis" as const },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {health
            ? `最后检测：${new Date(health.timestamp).toLocaleTimeString("zh-CN")}`
            : "每 30 秒自动刷新"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchHealth()}
          disabled={loadingHealth}
        >
          <RefreshCw className={cn("size-3.5", loadingHealth && "animate-spin")} />
          立即检测
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {services.map((svc) => {
          const status = health?.[svc.key];
          return (
            <div
              key={svc.key}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <StatusLight ok={status?.ok ?? false} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{svc.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {loadingHealth ? "检测中..." : (status?.detail ?? "—")}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  status?.ok
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
                )}
              >
                {loadingHealth ? "…" : status?.ok ? "正常" : "异常"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const { authUser, checkingAuth } = useRequireAuth();
  const router = useRouter();

  if (!ENABLE_AUTH) {
    router.replace("/");
    return null;
  }

  if (checkingAuth || !authUser) {
    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (!isAdmin(authUser)) {
    router.replace("/");
    return null;
  }

  return (
    <PageTransition>
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">管理后台</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          仅管理员可访问 · 商业模式（ENABLE_AUTH=true）专属功能
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <TabBar active={activeTab} onChange={setActiveTab} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="pt-1"
          >
            {activeTab === "users" && <UsersTab currentAdminId={authUser.user_id} />}
            {activeTab === "stats" && <StatsTab />}
            {activeTab === "health" && <HealthTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
    </PageTransition>
  );
}
