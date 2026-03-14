"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearAuthUser, getAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/types/udi";

export function useRequireAuth() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getAuthUser());

  useEffect(() => {
    if (!authUser) {
      router.replace("/login");
    }
  }, [authUser, router]);

  const logout = useCallback(() => {
    setAuthUser(null);
    clearAuthUser();
    router.replace("/login");
  }, [router]);

  return {
    authUser,
    checkingAuth: authUser === null,
    logout,
  };
}