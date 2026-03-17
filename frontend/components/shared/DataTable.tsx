"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toDisplayDate } from "@/lib/dateUtils";
import type { LabelHistoryItem } from "@/types/udi";

type DataTableProps = {
  rows: LabelHistoryItem[];
  onReview: (row: LabelHistoryItem) => void;
  onDelete: (id: number) => void;
  loadingRowId?: number | null;
  loading?: boolean;
  pagination?: {
    total: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
  };
};

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t">
          <td className="px-3 py-2"><Skeleton className="h-4 w-8" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-16" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
          <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
          <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-7 w-24" /></td>
        </tr>
      ))}
    </>
  );
}

export function DataTable({ rows, onReview, onDelete, loadingRowId, loading, pagination }: DataTableProps) {
  return (
    <div className="rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">GTIN</th>
            <th className="px-3 py-2 font-medium">批号</th>
            <th className="px-3 py-2 font-medium">有效期</th>
            <th className="px-3 py-2 font-medium">序列号</th>
            <th className="px-3 py-2 font-medium">创建时间</th>
            <th className="px-3 py-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                暂无历史记录
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.id}</td>
                <td className="px-3 py-2 font-mono">{row.gtin}</td>
                <td className="px-3 py-2">{row.batch_no ?? "-"}</td>
                <td className="px-3 py-2">{toDisplayDate(row.expiry_date)}</td>
                <td className="px-3 py-2">{row.serial_no ?? "-"}</td>
                <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingRowId === row.id}
                      onClick={() => onReview(row)}
                    >
                      {loadingRowId === row.id ? "加载中..." : "查看"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(row.id)}
                    >
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
        </table>
      </div>
      {pagination ? (
        <div className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground text-xs sm:text-sm">
            共 {pagination.total} 条
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasPrev}
              onClick={pagination.onPrev}
              className="text-xs"
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasNext}
              onClick={pagination.onNext}
              className="text-xs"
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
