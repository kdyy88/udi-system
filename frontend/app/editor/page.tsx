"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
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
import { api } from "@/lib/api";
import type { CanvasDefinition } from "@/types/template";

function NewEditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authUser, checkingAuth } = useRequireAuth();
  const seed = searchParams.get("seed");
  const seededSystemTemplate = seed
    ? SYSTEM_TEMPLATES.find((template) => template.id === seed) ?? null
    : null;
  const [templateName, setTemplateName] = useState(seededSystemTemplate?.name ?? "未命名模板");
  const [zoom, setZoom] = useState(1);
  const editingSysId = authUser && seededSystemTemplate && isAdmin(authUser)
    ? seededSystemTemplate.id
    : null;

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
            min={0.3}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24"
          />
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
        <aside className="w-52 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
          <ElementToolbar />
        </aside>

        {/* Canvas area */}
        <div className="flex flex-1 items-start justify-center overflow-auto p-6">
          <Canvas zoom={zoom} />
        </div>

        {/* Right properties */}
        <aside className="w-60 shrink-0 overflow-y-auto border-l bg-muted/20 p-3">
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
