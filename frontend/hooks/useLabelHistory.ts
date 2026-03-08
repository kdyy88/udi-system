import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { LabelHistoryItem, LabelHistoryListResponse } from "@/types/udi";

export function useLabelHistory() {
  const [historyRows, setHistoryRows] = useState<LabelHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingReviewId, setLoadingReviewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const pageSize = 10;

  const fetchHistory = useCallback(
    async (targetPage = 1, filterGtin = "", filterBatchNo = "") => {
      setLoadingHistory(true);
      try {
        const response = await api.get<LabelHistoryListResponse>(
          "/api/v1/labels/history",
          {
            params: {
              gtin: filterGtin || undefined,
              batch_no: filterBatchNo || undefined,
              page: targetPage,
              page_size: pageSize,
            },
          }
        );
        setHistoryRows(response.data.items);
        setTotal(response.data.total);
        setPage(response.data.page);
      } catch {
        toast.error("历史记录获取失败");
      } finally {
        setLoadingHistory(false);
      }
    },
    []
  );

  const handleDelete = async (id: number, onSuccess: () => void) => {
    if (!confirm("确定要删除此记录吗？")) {
      return;
    }

    try {
      await api.delete(`/api/v1/labels/history/${id}`);
      toast.success("删除成功");
      onSuccess();
    } catch {
      toast.error("删除失败");
    }
  };

  return {
    historyRows,
    loadingHistory,
    loadingReviewId,
    setLoadingReviewId,
    page,
    pageSize,
    total,
    fetchHistory,
    handleDelete,
  };
}
