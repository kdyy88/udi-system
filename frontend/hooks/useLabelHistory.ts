"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { LABELS_API_ROUTES } from "@/features/labels/api/routes";
import type { LabelHistoryListResponse } from "@/types/udi";

const PAGE_SIZE = 10;

async function fetchHistoryPage(
  userId: number,
  cursor: number | null,
  gtin: string,
  batchNo: string
): Promise<LabelHistoryListResponse> {
  const { data } = await api.get<LabelHistoryListResponse>(LABELS_API_ROUTES.history, {
    params: {
      user_id: userId,
      gtin: gtin || undefined,
      batch_no: batchNo || undefined,
      cursor: cursor ?? undefined,
      page_size: PAGE_SIZE,
    },
  });
  return data;
}

export function useLabelHistory() {
  const queryClient = useQueryClient();
  const authUser = getAuthUser();

  // cursorStack[0] is always null (first page); each "next" push appends next_cursor
  const [cursorStack, setCursorStack] = useState<(number | null)[]>([null]);
  const [filterGtin, setFilterGtin] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");

  const currentCursor = cursorStack[cursorStack.length - 1];

  const queryKey = ["label-history", authUser?.user_id, currentCursor, filterGtin, filterBatchNo] as const;

  const { data, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchHistoryPage(authUser!.user_id, currentCursor, filterGtin, filterBatchNo),
    enabled: !!authUser,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(LABELS_API_ROUTES.historyById(id), {
        params: { user_id: authUser?.user_id },
      }),
    onSuccess: () => {
      toast.success("删除成功");
      void queryClient.invalidateQueries({
        queryKey: ["label-history", authUser?.user_id],
      });
    },
    onError: () => {
      toast.error("删除失败");
    },
  });

  const handleSearch = (gtin: string, batchNo: string) => {
    setFilterGtin(gtin);
    setFilterBatchNo(batchNo);
    setCursorStack([null]); // reset to first page on new search
  };

  const handleDelete = (id: number) => {
    if (!confirm("确定要删除此记录吗？")) return;
    if (!authUser) {
      toast.error("请先登录");
      return;
    }
    deleteMutation.mutate(id);
  };

  const invalidateHistory = () => {
    void queryClient.invalidateQueries({
      queryKey: ["label-history", authUser?.user_id],
    });
  };

  const goToNextPage = () => {
    if (data?.next_cursor != null) {
      setCursorStack((prev) => [...prev, data.next_cursor!]);
    }
  };

  const goToPrevPage = () => {
    setCursorStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  return {
    historyRows: data?.items ?? [],
    loadingHistory: isFetching,
    total: data?.total ?? 0,
    hasPrev: cursorStack.length > 1,
    hasNext: data?.next_cursor != null,
    filterGtin,
    filterBatchNo,
    handleSearch,
    handleDelete,
    invalidateHistory,
    goToPrevPage,
    goToNextPage,
  };
}

