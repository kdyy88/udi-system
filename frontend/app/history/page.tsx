"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/DataTable";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { clearAuthUser, getAuthUser, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useLabelHistory } from "@/hooks/useLabelHistory";
import type { LabelHistoryItem, PreviewSource } from "@/types/udi";

export default function HistoryPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [localGtin, setLocalGtin] = useState("");
  const [localBatchNo, setLocalBatchNo] = useState("");
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    historyRows,
    loadingHistory,
    total,
    hasPrev,
    hasNext,
    handleSearch,
    handleDelete,
    goToPrevPage,
    goToNextPage,
  } = useLabelHistory();

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
    // router is a stable Next.js ref; state setters are also stable — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReview = (row: LabelHistoryItem) => {
    // Instant — bwip-js renders barcodes from hri inside PreviewDialog
    setPreviewSource({ kind: "history", data: row });
    setDialogOpen(true);
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
          <Input
            value={localGtin}
            maxLength={14}
            onChange={(e) => setLocalGtin(e.target.value.trim())}
          />
        </div>
        <div className="min-w-60 flex-1 space-y-2">
          <label className="text-sm font-medium">按批次号筛选</label>
          <Input value={localBatchNo} onChange={(e) => setLocalBatchNo(e.target.value.trim())} />
        </div>
        <Button onClick={() => handleSearch(localGtin, localBatchNo)} disabled={loadingHistory}>
          <Search />
          {loadingHistory ? "查询中..." : "查询"}
        </Button>
      </div>

      <DataTable
        rows={historyRows}
        onReview={handleReview}
        onDelete={handleDelete}
        pagination={{
          total,
          hasPrev,
          hasNext,
          onPrev: goToPrevPage,
          onNext: goToNextPage,
        }}
      />

      <PreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        previewSource={previewSource}
        expiryDate=""
      />
    </main>
  );
}


