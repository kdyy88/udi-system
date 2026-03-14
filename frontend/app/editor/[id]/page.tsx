"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Canvas } from "@/components/editor/Canvas";
import { ElementToolbar } from "@/components/editor/ElementToolbar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { useCanvasStore } from "@/stores/canvasStore";
import { useGetTemplate, useUpdateTemplate } from "@/hooks/useLabelTemplates";
import { clearAuthUser, getAuthUser, type AuthUser } from "@/lib/auth";
import { recordToDefinition } from "@/types/template";

export default function EditEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const templateId = parseInt(id, 10);

  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const canvasDef = useCanvasStore((s) => s.canvasDef);
  const updateTemplate = useUpdateTemplate();

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.replace("/login"); return; }
    setAuthUser(user);
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tmpl, isLoading } = useGetTemplate(
    templateId,
    authUser?.user_id ?? 0,
  );

  // Load template into canvas store once
  useEffect(() => {
    if (tmpl && !loaded) {
      setTemplateName(tmpl.name);
      loadCanvas(recordToDefinition(tmpl));
      setLoaded(true);
    }
  }, [tmpl, loaded, loadCanvas]);

  if (checkingAuth || !authUser || isLoading) {
    return <main className="p-6 text-sm text-muted-foreground">加载中…</main>;
  }

  if (!tmpl) {
    return <main className="p-6 text-sm text-destructive">模板不存在或无权访问</main>;
  }

  const handleSave = async () => {
    try {
      await updateTemplate.mutateAsync({
        id: templateId,
        userId: authUser.user_id,
        name: templateName,
        canvas: canvasDef(),
      });
      toast.success("模板已更新");
    } catch {
      toast.error("保存失败，请重试");
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
          <span className="text-sm text-muted-foreground">{authUser.username}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { clearAuthUser(); router.replace("/login"); }}
          >
            退出
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateTemplate.isPending}>
            <Save className="mr-1.5 size-4" />
            {updateTemplate.isPending ? "保存中…" : "保存模板"}
          </Button>
        </div>
      </header>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
          <ElementToolbar />
        </aside>
        <div className="flex flex-1 items-start justify-center overflow-auto p-6">
          <Canvas zoom={zoom} />
        </div>
        <aside className="w-60 shrink-0 overflow-y-auto border-l bg-muted/20 p-3">
          <PropertiesPanel />
        </aside>
      </div>
    </main>
  );
}
