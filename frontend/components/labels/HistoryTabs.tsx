"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ExternalLink, Layers, List } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { PreviewDialog } from "@/components/labels/PreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLabelHistory } from "@/hooks/useLabelHistory";
import { useLabelBatches } from "@/hooks/useLabelBatches";
import { api } from "@/lib/api";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import type { AuthUser, LabelHistoryItem, PreviewSource } from "@/types/udi";
import type { LabelBatchSummary } from "@/types/batch";

// ─── Batch List Table ─────────────────────────────────────────────────────────

function BatchListTable({
  items,
  onDelete,
}: {
  items: LabelBatchSummary[];
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">暂无批次记录</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border text-sm">
      <table className="w-full">
        <thead className="bg-muted/60">
          <tr>
            {["批次ID", "批次名称", "来源", "记录数", "创建时间", "操作"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((batch) => (
            <tr key={batch.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 tabular-nums">{batch.id}</td>
              <td className="px-3 py-2 max-w-xs truncate font-medium">{batch.name}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    batch.source === "excel"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {batch.source === "excel" ? "Excel 上传" : "表单生成"}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums">{batch.total_count} 条</td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {new Date(batch.created_at).toLocaleString("zh-CN")}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/history/batch/${batch.id}`}
                    className="flex items-center gap-1 text-primary hover:underline underline-offset-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    详情
                  </Link>
                  <button
                    onClick={() => onDelete(batch.id)}
                    className="text-destructive hover:underline underline-offset-2"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// ─── HistoryTabs ──────────────────────────────────────────────────────────────

type TabId = "batches" | "all";

/**
 * Self-contained dual-tab history component.
 * Tab 1: 批次总览 — batch list with delete + drill-down link.
 * Tab 2: 全部明细 — paginated label list with filter, review, delete.
 *
 * Used on both the homepage (below the form) and the /history page.
 */
export function HistoryTabs({ authUser }: { authUser: AuthUser }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("batches");
  const [localGtin, setLocalGtin] = useState("");
  const [localBatchNo, setLocalBatchNo] = useState("");
  const [previewSource, setPreviewSource] = useState<PreviewSource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    historyRows,
    loadingHistory,
    total: historyTotal,
    hasPrev: historyHasPrev,
    hasNext: historyHasNext,
    handleSearch,
    handleDelete,
    goToPrevPage: historyPrev,
    goToNextPage: historyNext,
  } = useLabelHistory();

  const {
    batchItems,
    loadingBatches,
    total: batchTotal,
    hasPrev: batchHasPrev,
    hasNext: batchHasNext,
    goToNextPage: batchNext,
    goToPrevPage: batchPrev,
  } = useLabelBatches(authUser);

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: number) =>
      api.delete(BATCHES_API_ROUTES.batchById(batchId), {
        params: { user_id: authUser.user_id },
      }),
    onSuccess: () => {
      toast.success("批次已删除");
      void queryClient.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: () => {
      toast.error("删除失败");
    },
  });

  const handleDeleteBatch = (batchId: number) => {
    if (!confirm("确定要删除此批次及其所有记录吗？此操作不可撤销。")) return;
    deleteBatchMutation.mutate(batchId);
  };

  const handleReview = (row: LabelHistoryItem) => {
    setPreviewSource({ kind: "history", data: row });
    setDialogOpen(true);
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex border-b">
        <TabButton
          active={activeTab === "batches"}
          onClick={() => setActiveTab("batches")}
          icon={Layers}
          label={`批次总览${batchTotal > 0 ? ` (${batchTotal})` : ""}`}
        />
        <TabButton
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          icon={List}
          label={`全部明细${historyTotal > 0 ? ` (${historyTotal})` : ""}`}
        />
      </div>

      {/* ── Tab: 批次总览 ── */}
      {activeTab === "batches" && (
        <div className="flex flex-col gap-4">
          {loadingBatches ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          ) : (
            <BatchListTable items={batchItems} onDelete={handleDeleteBatch} />
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">共 {batchTotal} 个批次</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!batchHasPrev} onClick={batchPrev}>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled={!batchHasNext} onClick={batchNext}>
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: 全部明细 ── */}
      {activeTab === "all" && (
        <div className="flex flex-col gap-4">
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
              <Input
                value={localBatchNo}
                onChange={(e) => setLocalBatchNo(e.target.value.trim())}
              />
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
              total: historyTotal,
              hasPrev: historyHasPrev,
              hasNext: historyHasNext,
              onPrev: historyPrev,
              onNext: historyNext,
            }}
          />
        </div>
      )}

      <PreviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        previewSource={previewSource}
        expiryDate=""
        onSaved={() =>
          void queryClient.invalidateQueries({ queryKey: ["label-history", authUser.user_id] })
        }
      />
    </>
  );
}
