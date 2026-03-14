"use client";

import type { AuthUser } from "@/types/udi";

export const AUTH_STORAGE_KEY = "gs1_udi_auth_user";

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function setAuthUser(user: AuthUser): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthUser(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
