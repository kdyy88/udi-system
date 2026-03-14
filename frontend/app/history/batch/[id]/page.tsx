"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { saveAs } from "file-saver";
import { ArrowLeft, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { BATCHES_API_ROUTES } from "@/features/labels/api/routes";
import { exportBatchToZip, fetchAllBatchLabels } from "@/lib/batchExporter";
import type { LabelBatchDetailResponse, BatchTemplate } from "@/types/batch";
import type { LabelHistoryItem } from "@/types/udi";

const PAGE_SIZE = 50;

async function fetchBatchDetail(
  batchId: number,
  userId: number,
  cursor: number | null,
): Promise<LabelBatchDetailResponse> {
  const params: Record<string, string> = {
    user_id: String(userId),
    page_size: String(PAGE_SIZE),
  };
  if (cursor != null) params.cursor = String(cursor);
  const res = await api.get<LabelBatchDetailResponse>(
    BATCHES_API_ROUTES.batchById(batchId),
    { params },
  );
  return res.data;
}

function LabelTable({ labels }: { labels: LabelHistoryItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border text-sm">
      <table className="w-full">
        <thead className="bg-muted/60">
          <tr>
            {["#", "GTIN-14", "批次号", "有效期", "序列号", "HRI", "生成时间"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {labels.map((row, i) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-mono">{row.gtin}</td>
              <td className="px-3 py-2">{row.batch_no ?? "—"}</td>
              <td className="px-3 py-2">{row.expiry_date ?? "—"}</td>
              <td className="px-3 py-2">{row.serial_no ?? "—"}</td>
              <td className="px-3 py-2 max-w-xs truncate font-mono text-xs text-muted-foreground">
                {row.hri}
              </td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {new Date(row.created_at).toLocaleString("zh-CN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchId = parseInt(params.id ?? "0", 10);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [template] = useState<BatchTemplate>("dual");

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["batch-detail", batchId, authUser?.user_id, cursor],
    queryFn: () => fetchBatchDetail(batchId, authUser!.user_id, cursor),
    enabled: !!authUser && batchId > 0,
    staleTime: 60_000,
  });

  const handleReDownload = useCallback(async () => {
    if (!authUser || !data) return;
    setDownloading(true);
    try {
      const labels = await fetchAllBatchLabels(batchId, authUser.user_id);
      const blob = await exportBatchToZip({
        batchId,
        batchName: data.name,
        labels,
        template,
        onProgress: () => {},
      });
      saveAs(blob, `UDI_${data.name}_${batchId}.zip`);
    } catch (err) {
      console.error("Re-download failed", err);
    } finally {
      setDownloading(false);
    }
  }, [authUser, data, batchId, template]);

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态…</main>;
  }

  if (isLoading || !data) {
    return (
      <main className="p-6 text-sm text-muted-foreground">
        {isLoading ? "加载中…" : "批次不存在"}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      {/* Back */}
      <Link
        href="/history"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回历史记录
      </Link>

      {/* Batch Summary */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>批次 ID: {data.id}</span>
            <span>来源: {data.source === "excel" ? "Excel 上传" : "表单生成"}</span>
            <span>共 {data.total_count} 条记录</span>
            <span>创建时间: {new Date(data.created_at).toLocaleString("zh-CN")}</span>
          </div>
        </div>

        <Button
          variant="outline"
          disabled={downloading}
          onClick={handleReDownload}
          className="shrink-0"
        >
          {downloading ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              生成中…
            </>
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              重新下载 ZIP
            </>
          )}
        </Button>
      </div>

      {/* Label Table */}
      <LabelTable labels={data.labels} />

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          当前页 {data.labels.length} 条 / 共 {data.total_count} 条
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cursor === null}
            onClick={() => setCursor(null)}
          >
            首页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.next_cursor}
            onClick={() => setCursor(data.next_cursor)}
          >
            下一页
          </Button>
        </div>
      </div>
    </main>
  );
}
