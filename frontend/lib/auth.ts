"use client";

import type { AuthUser } from "@/types/udi";

export const AUTH_STORAGE_KEY = "gs1_udi_auth_user";
const AUTH_CHANGE_EVENT = "gs1-auth-user-change";
let authUserCache: AuthUser | null | undefined;

function readAuthUserFromStorage(): AuthUser | null {
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

function refreshAuthUserCache(): AuthUser | null {
  authUserCache = readAuthUserFromStorage();
  return authUserCache;
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function setAuthUser(user: AuthUser): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  authUserCache = user;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthUser(): AuthUser | null {
  if (authUserCache !== undefined) {
    return authUserCache;
  }

  return refreshAuthUserCache();
}

export function clearAuthUser(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  authUserCache = null;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/**
 * Re-validate the session by calling /api/v1/auth/users/me.
 * On success, refreshes localStorage with the latest user data.
 * On 401 (cookie expired / missing), clears auth state.
 */
export async function initSession(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/v1/auth/users/me", { credentials: "include" });
    if (!res.ok) {
      clearAuthUser();
      return null;
    }
    const me = await res.json() as { id: number; username?: string; email: string; role?: string };
    const user: AuthUser = {
      user_id: me.id,
      username: me.username ?? me.email.split("@")[0],
      email: me.email,
      role: me.role ?? "operator",
    };
    setAuthUser(user);
    return user;
  } catch {
    return getAuthUser();
  }
}

export function subscribeAuthUser(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) {
      refreshAuthUserCache();
      onStoreChange();
    }
  };

  const handleAuthChange = () => {
    refreshAuthUserCache();
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  };
}
