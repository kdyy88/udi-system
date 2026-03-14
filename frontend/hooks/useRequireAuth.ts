"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { clearAuthUser, getAuthUser, subscribeAuthUser } from "@/lib/auth";

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

  useEffect(() => {
    if (hydrated && !authUser) {
      router.replace("/login");
    }
  }, [authUser, hydrated, router]);

  const logout = useCallback(() => {
    clearAuthUser();
    router.replace("/login");
  }, [router]);

  return {
    authUser,
    checkingAuth: !hydrated,
    logout,
  };
}