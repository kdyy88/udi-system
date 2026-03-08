"use client";

import { Button } from "@/components/ui/button";
import type { LabelHistoryItem } from "@/types/udi";

type DataTableProps = {
  rows: LabelHistoryItem[];
  onReview: (row: LabelHistoryItem) => void;
  onDelete: (id: number) => void;
  loadingRowId?: number | null;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
};

export function DataTable({ rows, onReview, onDelete, loadingRowId, pagination }: DataTableProps) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

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
          {rows.length === 0 ? (
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
                <td className="px-3 py-2">{row.expiry_date ?? "-"}</td>
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
            共 {pagination.total} 条，当前第 {pagination.page}/{totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={pagination.onPrev}
              className="text-xs"
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= totalPages}
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
