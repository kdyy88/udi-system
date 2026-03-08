"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LayoutTemplate, Search } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

import { PreviewTemplateCanvas } from "@/components/labels/PreviewTemplateCanvas";
import { DataTable } from "@/components/shared/DataTable";
import { clearAuthUser, getAuthUser, type AuthUser } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  DEFAULT_TEMPLATE_KEY,
  PREVIEW_TEMPLATES,
  type TemplateKey,
} from "@/lib/preview-templates";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  LabelGenerateResponse,
  LabelHistoryItem,
  LabelHistoryListResponse,
  LabelPreviewResponse,
} from "@/types/udi";

function toYymmdd(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return undefined;
  }
  return `${year.slice(-2)}${month}${day}`;
}

function toDisplayDate(yymmdd?: string | null): string {
  if (!yymmdd || yymmdd.length !== 6) {
    return "-";
  }
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [di, setDi] = useState("09506000134352");
  const [lot, setLot] = useState("LOT202603");
  const [expiryDate, setExpiryDate] = useState("2028-02-29");
  const [serial, setSerial] = useState("SN0001");
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  const [historyRows, setHistoryRows] = useState<LabelHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterGtin, setFilterGtin] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<LabelGenerateResponse | LabelPreviewResponse | null>(
    null
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setAuthUser(user);
    setCheckingAuth(false);
  }, [router]);

  const fetchHistory = useCallback(async (targetPage = 1) => {
    const pageToLoad = targetPage;
    setLoadingHistory(true);
    try {
      const response = await api.get<LabelHistoryListResponse>("/api/v1/labels/history", {
        params: {
          gtin: filterGtin || undefined,
          batch_no: filterBatchNo || undefined,
          page: pageToLoad,
          page_size: pageSize,
        },
      });
      setHistoryRows(response.data.items);
      setTotal(response.data.total);
      setPage(response.data.page);
    } catch {
      toast.error("历史记录获取失败");
    } finally {
      setLoadingHistory(false);
    }
  }, [filterBatchNo, filterGtin]);

  useEffect(() => {
    if (!checkingAuth && authUser) {
      void fetchHistory(1);
    }
  }, [authUser, checkingAuth, fetchHistory]);

  const handleGenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authUser) {
      toast.error("请先登录");
      router.replace("/login");
      return;
    }
    if (di.length !== 14) {
      toast.error("DI 必须是 14 位 GTIN");
      return;
    }

    setLoadingGenerate(true);
    try {
      const generateRes = await api.post<LabelGenerateResponse>("/api/v1/labels/generate", {
        user_id: authUser.user_id,
        di,
        lot: lot || null,
        expiry: toYymmdd(expiryDate) ?? null,
        serial: serial || null,
      });

      setPreview(generateRes.data);
      setDialogOpen(true);
      toast.success("生成成功，已入库");
      await fetchHistory(1);
    } catch {
      toast.error("生成失败，请检查 DI/PI 参数");
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleReview = async (row: LabelHistoryItem) => {
    try {
      const response = await api.post<LabelPreviewResponse>("/api/v1/labels/preview", {
        di: row.gtin,
        lot: row.batch_no,
        expiry: row.expiry_date,
        serial: row.serial_no,
      });
      setPreview(response.data);
      setDialogOpen(true);
    } catch {
      toast.error("重新预览失败");
    }
  };

  const previewMeta = useMemo(() => {
    if (!preview) {
      return null;
    }
    return [
      { label: "HRI", value: preview.hri },
      { label: "GS1 Element String", value: preview.gs1_element_string_escaped },
    ];
  }, [preview]);

  const selectedTemplate = useMemo(
    () => PREVIEW_TEMPLATES.find((item) => item.key === template),
    [template]
  );

  const downloadByDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handleDownload = async (format: "png" | "svg" | "pdf") => {
    if (!previewRef.current) {
      toast.error("暂无可下载的预览内容");
      return;
    }

    try {
      if (format === "png") {
        const dataUrl = await toPng(previewRef.current, {
          backgroundColor: "transparent",
          pixelRatio: 2,
          cacheBust: true,
        });
        downloadByDataUrl(dataUrl, `udi-${template}.png`);
        return;
      }

      if (format === "svg") {
        const dataUrl = await toSvg(previewRef.current, {
          backgroundColor: "transparent",
          cacheBust: true,
        });
        downloadByDataUrl(dataUrl, `udi-${template}.svg`);
        return;
      }

      const pngDataUrl = await toPng(previewRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("load image failed"));
        image.src = pngDataUrl;
      });

      const pdf = new jsPDF({
        orientation: image.width > image.height ? "landscape" : "portrait",
        unit: "pt",
        format: [image.width, image.height],
      });
      pdf.addImage(pngDataUrl, "PNG", 0, 0, image.width, image.height);
      pdf.save(`udi-${template}.pdf`);
    } catch {
      toast.error("下载失败，请重试");
    }
  };

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GS1 UDI 后台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            录入 DI/PI，生成条码并持久化，支持历史筛选与重新查看。
          </p>
        </div>
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
      </header>

      <section className="rounded-xl border p-5">
        <h2 className="text-lg font-semibold">标签录入表单</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleGenerate}>
          <div className="space-y-2">
            <label className="text-sm font-medium">DI / GTIN-14</label>
            <Input
              value={di}
              onChange={(e) => setDi(e.target.value.trim())}
              minLength={14}
              maxLength={14}
              placeholder="09506000134352"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">PI(10) 批号</label>
            <Input
              value={lot}
              onChange={(e) => setLot(e.target.value.trim())}
              placeholder="LOT202603"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">PI(17) 有效期</label>
            <DatePicker value={expiryDate} onChange={setExpiryDate} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">PI(21) 序列号</label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value.trim())}
              placeholder="SN0001"
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={loadingGenerate}>
              {loadingGenerate ? "生成中..." : "生成"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1 space-y-2">
            <label className="text-sm font-medium">按 GTIN 筛选</label>
            <Input
              value={filterGtin}
              maxLength={14}
              placeholder="09506000134352"
              onChange={(e) => setFilterGtin(e.target.value.trim())}
            />
          </div>
          <div className="min-w-60 flex-1 space-y-2">
            <label className="text-sm font-medium">按批次号筛选</label>
            <Input
              value={filterBatchNo}
              placeholder="LOT202603"
              onChange={(e) => setFilterBatchNo(e.target.value.trim())}
            />
          </div>
          <Button onClick={() => void fetchHistory(1)} disabled={loadingHistory}>
            <Search />
            {loadingHistory ? "查询中..." : "查询历史"}
          </Button>
        </div>

        <div className="mt-4">
          <DataTable
            rows={historyRows}
            onReview={handleReview}
            pagination={{
              page,
              pageSize,
              total,
              onPrev: () => void fetchHistory(page - 1),
              onNext: () => void fetchHistory(page + 1),
            }}
          />
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>条码实时预览</DialogTitle>
            <DialogDescription>支持模板切换与下载：PDF / SVG / 透明背景 PNG</DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <LayoutTemplate className="size-4" />
                    模板
                  </span>
                  {PREVIEW_TEMPLATES.map((item) => (
                    <Button
                      key={item.key}
                      size="sm"
                      variant={template === item.key ? "default" : "outline"}
                      onClick={() => setTemplate(item.key)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleDownload("png")}>
                    <Download className="size-4" /> PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleDownload("svg")}>
                    <Download className="size-4" /> SVG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleDownload("pdf")}>
                    <Download className="size-4" /> PDF
                  </Button>
                </div>
              </div>

              {selectedTemplate ? (
                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
              ) : null}

              <div ref={previewRef} className="rounded-md border border-dashed p-3">
                <PreviewTemplateCanvas
                  template={template}
                  preview={preview}
                  lot={lot}
                  expiryDisplay={toDisplayDate(toYymmdd(expiryDate) ?? null)}
                />
              </div>

              {previewMeta?.map((item) => (
                <div key={item.label} className="rounded-md bg-muted/50 p-2 text-sm">
                  <p className="font-medium">{item.label}</p>
                  <p className="break-all text-muted-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
