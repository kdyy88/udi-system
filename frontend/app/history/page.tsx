"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { clearAuthUser, getAuthUser, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { LABELS_API_ROUTES } from "@/features/labels/api/routes";
import type {
  LabelHistoryDetail,
  LabelHistoryItem,
  LabelHistoryListResponse,
  LabelPreviewResponse,
} from "@/types/udi";

export default function HistoryPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [rows, setRows] = useState<LabelHistoryItem[]>([]);
  const [gtin, setGtin] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<LabelPreviewResponse | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
  }, [router]);

  const loadHistory = async (targetPage = 1) => {
    setLoading(true);
    try {
      const response = await api.get<LabelHistoryListResponse>(LABELS_API_ROUTES.history, {
        params: {
          user_id: authUser?.user_id,
          gtin: gtin || undefined,
          batch_no: batchNo || undefined,
          page: targetPage,
          page_size: pageSize,
        },
      });
      setRows(response.data.items);
      setTotal(response.data.total);
      setPage(response.data.page);
    } catch {
      toast.error("历史记录获取失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth && authUser) {
      void loadHistory(1);
    }
  }, [authUser, checkingAuth]);

  const handleReview = async (row: LabelHistoryItem) => {
    try {
      const detail = await api.get<LabelHistoryDetail>(
        LABELS_API_ROUTES.historyDetail(row.id),
        {
          params: {
            user_id: authUser?.user_id,
          },
        }
      );
      setPreview({
        di: row.gtin,
        hri: row.hri,
        gs1_element_string: row.full_string,
        gs1_element_string_escaped: row.full_string,
        datamatrix_base64: detail.data.datamatrix_base64,
        gs1_128_base64: detail.data.gs1_128_base64,
      });
      setOpen(true);
    } catch {
      toast.error("打开历史预览失败");
    }
  };

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">历史记录台账</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">当前用户：{authUser.username}</span>
          <Button
            variant="outline"
            onClick={() => {
              clearAuthUser();
              router.replace("/login");
            }}
          >
            退出登录
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <div className="min-w-60 flex-1 space-y-2">
          <label className="text-sm font-medium">按 GTIN 筛选</label>
          <Input value={gtin} maxLength={14} onChange={(e) => setGtin(e.target.value.trim())} />
        </div>
        <div className="min-w-60 flex-1 space-y-2">
          <label className="text-sm font-medium">按批次号筛选</label>
          <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value.trim())} />
        </div>
        <Button onClick={() => void loadHistory(1)} disabled={loading}>
          <Search />
          {loading ? "查询中..." : "查询"}
        </Button>
      </div>

      <DataTable
        rows={rows}
        onReview={handleReview}
        onDelete={() => {}}
        pagination={{
          page,
          pageSize,
          total,
          onPrev: () => void loadHistory(page - 1),
          onNext: () => void loadHistory(page + 1),
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>条码预览</DialogTitle>
            <DialogDescription>历史记录重新查看</DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={`data:image/png;base64,${preview.datamatrix_base64}`}
              alt="History Barcode"
              className="mx-auto mt-4 rounded-md border p-2"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
