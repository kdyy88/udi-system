/**
 * Admin panel hooks (Shell layer — only used when ENABLE_AUTH=true).
 *
 * Covers:
 *   - useAdminUsers()   → user list + mutate (update status/role, delete)
 *   - useAdminStats()   → aggregate label/batch/user counters
 *   - useAdminHealth()  → DB + Redis status probe
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AdminUserSummary {
  id: number;
  email: string;
  username: string | null;
  role: "admin" | "operator";
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AdminUserListResponse {
  total: number;
  items: AdminUserSummary[];
}

export interface AdminUserUpdateRequest {
  is_active?: boolean;
  role?: "admin" | "operator";
}

export interface AdminStatsResponse {
  total_labels: number;
  today_labels: number;
  total_batches: number;
  total_users: number;
  active_users: number;  // distinct users who created a label in the last 30 days
}

export interface ServiceStatus {
  ok: boolean;
  detail: string;
}

export interface AdminHealthResponse {
  timestamp: string;
  database: ServiceStatus;
  redis: ServiceStatus;
}

// ── Keys ───────────────────────────────────────────────────────────────────

const KEYS = {
  users: ["admin", "users"] as const,
  stats: ["admin", "stats"] as const,
  health: ["admin", "health"] as const,
};

// ── User management ────────────────────────────────────────────────────────

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: KEYS.users,
    queryFn: async () => {
      const res = await api.get<AdminUserListResponse>("/api/v1/admin/users");
      return res.data;
    },
    staleTime: 30_000,
  });

  const updateUser = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: AdminUserUpdateRequest;
    }) => {
      const res = await api.patch<AdminUserSummary>(
        `/api/v1/admin/users/${userId}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.users });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/v1/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.users });
    },
  });

  return {
    users: data?.items ?? [],
    totalUsers: data?.total ?? 0,
    loadingUsers: isLoading,
    updateUser,
    deleteUser,
  };
}

// ── Stats ──────────────────────────────────────────────────────────────────

export function useAdminStats() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: KEYS.stats,
    queryFn: async () => {
      const res = await api.get<AdminStatsResponse>("/api/v1/admin/stats");
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return { stats: data ?? null, loadingStats: isLoading, refetchStats: refetch, statsUpdatedAt: dataUpdatedAt };
}

// ── Health ─────────────────────────────────────────────────────────────────

export function useAdminHealth() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: KEYS.health,
    queryFn: async () => {
      const res = await api.get<AdminHealthResponse>("/api/v1/admin/health");
      return res.data;
    },
    staleTime: 0,        // always re-fetch on mount
    refetchInterval: 30_000,
  });

  return { health: data ?? null, loadingHealth: isLoading, refetchHealth: refetch };
}
