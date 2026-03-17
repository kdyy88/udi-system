"use client";

import type { AuthUser } from "@/types/udi";

const ENABLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

export const AUTH_STORAGE_KEY = "gs1_udi_auth_user";
const AUTH_CHANGE_EVENT = "gs1-auth-user-change";
const AUTH_SESSION_EVENT = "gs1-auth-session-change";

/** Default user returned when auth is disabled (pure-tool mode). */
const MOCK_USER: AuthUser = {
  user_id: "anonymous",
  username: "local-user",
  role: "admin",
};

// In tool mode the cache is eagerly set to MOCK_USER so that every call to
// getAuthUser() — including the very first SSR-hydration render — sees a
// deterministic "authenticated" state.  This eliminates the brief "checking
// auth" flash that would otherwise occur before initSession() completes.
let authUserCache: AuthUser | null | undefined = ENABLE_AUTH ? undefined : MOCK_USER;
let authSessionStatus: "idle" | "checking" | "resolved" = ENABLE_AUTH ? "idle" : "resolved";
let initSessionPromise: Promise<AuthUser | null> | null = null;

function setAuthSessionStatus(status: "idle" | "checking" | "resolved"): void {
  authSessionStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

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
  setAuthSessionStatus("resolved");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthUser(): AuthUser | null {
  if (!ENABLE_AUTH) return MOCK_USER;

  if (authUserCache !== undefined) {
    return authUserCache;
  }

  return refreshAuthUserCache();
}

export function clearAuthUser(): void {
  if (!ENABLE_AUTH) return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  authUserCache = null;
  setAuthSessionStatus("resolved");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAuthSessionStatus(): "idle" | "checking" | "resolved" {
  return authSessionStatus;
}

/**
 * Re-validate the session by calling /api/v1/auth/users/me.
 * On success, refreshes localStorage with the latest user data.
 * On 401 (cookie expired / missing), clears auth state.
 */
export async function initSession(): Promise<AuthUser | null> {
  if (!ENABLE_AUTH) return MOCK_USER;

  if (initSessionPromise) {
    return initSessionPromise;
  }

  setAuthSessionStatus("checking");

  initSessionPromise = (async () => {
    try {
      const res = await fetch("/api/v1/auth/users/me", { credentials: "include" });
      if (!res.ok) {
        clearAuthUser();
        return null;
      }
      const me = await res.json() as { id: number; username?: string; email: string; role?: string };
      const user: AuthUser = {
        user_id: String(me.id),
        username: me.username ?? me.email.split("@")[0],
        email: me.email,
        role: me.role ?? "operator",
      };
      setAuthUser(user);
      return user;
    } catch {
      setAuthSessionStatus("resolved");
      return getAuthUser();
    } finally {
      initSessionPromise = null;
    }
  })();

  return initSessionPromise;
}

export function subscribeAuthUser(onStoreChange: () => void): () => void {
  if (!ENABLE_AUTH) return () => {};

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

export function subscribeAuthSession(onStoreChange: () => void): () => void {
  if (!ENABLE_AUTH || typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(AUTH_SESSION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, onStoreChange);
  };
}
