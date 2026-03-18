"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Save, RotateCcw, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Canvas } from "@/components/editor/Canvas";
import { ElementToolbar } from "@/components/editor/ElementToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCreateTemplate } from "@/hooks/useLabelTemplates";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSaveSystemTemplateOverride } from "@/hooks/useSystemTemplateOverrides";
import { isAdmin } from "@/lib/auth";
import { SYSTEM_TEMPLATES } from "@/lib/systemTemplates";
import { downloadCanvasAsSvg } from "@/lib/canvasToSvg";
import { api } from "@/lib/api";
import type { CanvasDefinition } from "@/types/template";

/** Mock HRI used when exporting from the editor (no real label data available). */
const EDITOR_MOCK_HRI =
  "(01)09506000134376(17)260101(10)LOT001(21)SN123456(11)240101";

function NewEditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, checkingAuth } = useRequireAuth();
  const seed = searchParams.get("seed");
  const seededSystemTemplate = seed
    ? SYSTEM_TEMPLATES.find((template) => template.id === seed) ?? null
    : null;
  const [templateName, setTemplateName] = useState(seededSystemTemplate?.name ?? "未命名模板");
  // displayScale: every design-unit coordinate is multiplied by this factor before
  // writing to the DOM (no CSS transform is used), so selection outlines & resize
  // handles are always exactly 1 physical pixel regardless of the current scale.
  const [displayScale, setDisplayScale] = useState(2);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasWidthPx = useCanvasStore((s) => s.widthPx);
  const canvasHeightPx = useCanvasStore((s) => s.heightPx);
  const editingSysId = authUser && seededSystemTemplate && isAdmin(authUser)
    ? seededSystemTemplate.id
    : null;

  // Auto-fit: find the largest displayScale that keeps the card inside the area.
  const computeFitScale = useCallback(() => {
    const el = canvasAreaRef.current;
    if (!el || canvasWidthPx === 0 || canvasHeightPx === 0) return;
    const pad = 64;
    const fitW = (el.clientWidth  - pad) / canvasWidthPx;
    const fitH = (el.clientHeight - pad) / canvasHeightPx;
    setDisplayScale(Math.min(fitW, fitH, 6));
  }, [canvasWidthPx, canvasHeightPx]);

  const resetCanvas = useCanvasStore((s) => s.resetCanvas);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const canvasDef = useCanvasStore((s) => s.canvasDef);
  const createTemplate = useCreateTemplate();
  const saveOverride = useSaveSystemTemplateOverride();

  useEffect(() => {
    if (!authUser) return;

    if (seededSystemTemplate) {
      api
        .get<{ value: Record<string, CanvasDefinition> }>("/api/v1/system/template-overrides")
        .then((r) => {
          const override = r.data?.value?.[seededSystemTemplate.id];
          loadCanvas(override ?? seededSystemTemplate.canvas);
        })
        .catch(() => {
          loadCanvas(seededSystemTemplate.canvas);
        });
      return;
    }
    resetCanvas();
  }, [authUser, seededSystemTemplate, loadCanvas, resetCanvas]);

  if (checkingAuth || !authUser) {
    return <main className="p-6 text-sm text-muted-foreground">正在检查登录状态…</main>;
  }

  /** Admin: overwrite the system template in DB. */
  const handleUpdateSystemTemplate = async () => {
    if (!editingSysId) return;
    const def = canvasDef();
    if (def.elements.length === 0) {
      toast.warning("画布为空，请先添加元素再保存");
      return;
    }
    try {
      await saveOverride.mutateAsync({ sysId: editingSysId, canvas: def });
      toast.success(`系统模板「${templateName}」已更新`);
      router.push("/templates");
    } catch {
      toast.error("更新失败，请重试");
    }
  };

  /** Save as a new personal template (always available). */
  const handleSaveAsNew = async () => {
    const def = canvasDef();
    if (def.elements.length === 0) {
      toast.warning("画布为空，请先添加元素再保存");
      return;
    }
    const name = editingSysId ? `${templateName} 副本` : templateName;
    try {
      const result = await createTemplate.mutateAsync({
        name,
        canvas: def,
      });
      toast.success(`模板「${result.name}」已保存`);
      router.push(`/editor/${result.id}`);
    } catch {
      toast.error("保存失败，请重试");
    }
  };

  const isBusy = createTemplate.isPending || saveOverride.isPending;

  /** Export the current canvas as a vector SVG using mock data. */
  const handleExportSvg = () => {
    const def = canvasDef();
    if (def.elements.length === 0) {
      toast.warning("画布为空，无法导出");
      return;
    }
    try {
      downloadCanvasAsSvg(def, { hri: EDITOR_MOCK_HRI }, `${templateName || "label"}.svg`);
      toast.success("SVG 已导出（使用模拟数据）");
    } catch (err) {
      console.error("SVG export failed", err);
      toast.error("SVG 导出失败，请重试");
    }
  };

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2">
        <Input
          className="h-8 w-52 text-sm font-medium"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="模板名称"
        />
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>缩放</span>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.25}
            value={displayScale}
            onChange={(e) => setDisplayScale(parseFloat(e.target.value))}
            className="w-28"
          />
          <span className="w-10 text-right tabular-nums">{displayScale.toFixed(2)}×</span>
          <button
            type="button"
            className="ml-1 rounded border px-1.5 py-0.5 text-xs hover:bg-muted"
            onClick={computeFitScale}
            title="自动适配窗口"
          >
            适配
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleExportSvg} title="导出 SVG（模拟数据）">
            <FileDown className="mr-1.5 size-4" />
            导出 SVG
          </Button>
          {editingSysId ? (
            /* Admin editing a system template: primary = update original, secondary = save as copy */
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAsNew}
                disabled={isBusy}
              >
                <Save className="mr-1.5 size-4" />
                另存为个人模板
              </Button>
              <Button
                size="sm"
                onClick={handleUpdateSystemTemplate}
                disabled={isBusy}
              >
                <RotateCcw className="mr-1.5 size-4" />
                {saveOverride.isPending ? "更新中…" : "更新系统模板"}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleSaveAsNew} disabled={isBusy}>
              <Save className="mr-1.5 size-4" />
              {createTemplate.isPending ? "保存中…" : "保存模板"}
            </Button>
          )}
        </div>
      </header>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
          <ElementToolbar />
        </aside>

        {/* Canvas area — no scrollbars; Canvas fills this area and centres the card internally */}
        <div
          ref={canvasAreaRef}
          className="relative flex-1 overflow-hidden bg-muted/30"
        >
          <Canvas displayScale={displayScale} />
        </div>

        {/* Right properties */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-muted/20 p-3">
          <PropertiesPanel />
        </aside>
      </div>
    </main>
  );
}

export default function NewEditorPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">正在加载编辑器…</main>}>
      <NewEditorPageContent />
    </Suspense>
  );
}
