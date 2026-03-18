"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import {
  clearAuthUser,
  getAuthSessionStatus,
  getAuthUser,
  initSession,
  subscribeAuthSession,
  subscribeAuthUser,
} from "@/lib/auth";

const ENABLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useRequireAuth() {
  const router = useRouter();
  const hydrated = useHydrated();
  const authUser = useSyncExternalStore(subscribeAuthUser, getAuthUser, () => null);
  const sessionStatus = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionStatus,
    () => (ENABLE_AUTH ? "idle" : "resolved")
  );

  useEffect(() => {
    if (!ENABLE_AUTH || !hydrated || authUser || sessionStatus !== "idle") {
      return;
    }
    void initSession();
  }, [authUser, hydrated, sessionStatus]);

  useEffect(() => {
    if (ENABLE_AUTH && hydrated && sessionStatus === "resolved" && !authUser) {
      router.replace("/login");
    }
  }, [authUser, hydrated, router, sessionStatus]);

  const logout = useCallback(() => {
    if (!ENABLE_AUTH) return;
    clearAuthUser();
    router.replace("/login");
  }, [router]);

  return {
    authUser,
    // In tool mode getAuthUser() always returns MOCK_USER, so never "checking"
    checkingAuth: ENABLE_AUTH ? !hydrated || (!authUser && sessionStatus !== "resolved") : false,
    logout,
  };
}