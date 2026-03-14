/**
 * Cursor-based batch list hook (TanStack Query).
 *
 * Mirrors the cursor pagination pattern used by useLabelHistory.
 */

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import type { LabelBatchListResponse } from "@/types/batch";
import type { AuthUser } from "@/types/udi";

const PAGE_SIZE = 10;

type CursorHistory = {
  /** forward cursor stack: entry n contains the cursor to reach page n+1 */
  stack: Array<number | null>;
  current: number; // 0-based page index
};

async function fetchBatches(
  userId: number,
  cursor: number | null | undefined,
  pageSize: number,
): Promise<LabelBatchListResponse> {
  const params: Record<string, string> = {
    user_id: String(userId),
    page_size: String(pageSize),
  };
  if (cursor != null) params.cursor = String(cursor);

  const res = await api.get<LabelBatchListResponse>(BATCHES_API_ROUTES.batches, { params });
  return res.data;
}

export function useLabelBatches(authUser: AuthUser | null) {
  const [cursorHistory, setCursorHistory] = useState<CursorHistory>({
    stack: [null],
    current: 0,
  });

  const currentCursor = cursorHistory.stack[cursorHistory.current] ?? null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["batches", authUser?.user_id, currentCursor, PAGE_SIZE],
    queryFn: () => fetchBatches(authUser!.user_id, currentCursor, PAGE_SIZE),
    enabled: authUser !== null,
    staleTime: 30_000,
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const nextCursor = data?.next_cursor ?? null;
  const hasPrev = cursorHistory.current > 0;
  const hasNext = nextCursor !== null;

  const goToNextPage = useCallback(() => {
    if (nextCursor === null) return;
    setCursorHistory((prev) => {
      const newStack = [...prev.stack.slice(0, prev.current + 1), nextCursor];
      return { stack: newStack, current: prev.current + 1 };
    });
  }, [nextCursor]);

  const goToPrevPage = useCallback(() => {
    setCursorHistory((prev) => {
      if (prev.current === 0) return prev;
      return { ...prev, current: prev.current - 1 };
    });
  }, []);

  const resetPagination = useCallback(() => {
    setCursorHistory({ stack: [null], current: 0 });
  }, []);

  return {
    batchItems: items,
    loadingBatches: isLoading,
    total,
    hasPrev,
    hasNext,
    goToNextPage,
    goToPrevPage,
    resetPagination,
    refetch,
  };
}
