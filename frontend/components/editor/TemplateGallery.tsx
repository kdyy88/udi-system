"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useListTemplates, useDeleteTemplate } from "@/hooks/useLabelTemplates";
import { useHiddenSystemTemplates, useSetHiddenSystemTemplates } from "@/hooks/useHiddenSystemTemplates";
import { useSystemTemplateOverrides, useDeleteSystemTemplateOverride } from "@/hooks/useSystemTemplateOverrides";
import { recordToDefinition, type CanvasDefinition } from "@/types/template";
import { applyOverrides } from "@/lib/systemTemplates";
import { cn } from "@/lib/utils";

type Mode = "manage" | "select";

type Props = {
  mode: Mode;
  /** Whether the current user is an admin (may edit/hide system templates). */
  isAdmin?: boolean;
  /** Selected template ID — "sys-xxx" for system templates, numeric string for user templates */
  selectedId?: string | null;
  onSelect?: (def: CanvasDefinition, id: string, name: string) => void;
  canPreview?: boolean;
  onPreview?: (def: CanvasDefinition, name: string) => void;
};

export function TemplateGallery({
  mode,
  isAdmin = false,
  selectedId,
  onSelect,
  canPreview = false,
  onPreview,
}: Props) {
  const { data, isLoading } = useListTemplates();
  const deleteMut = useDeleteTemplate();

  const { data: hiddenData } = useHiddenSystemTemplates();
  const setHiddenMut = useSetHiddenSystemTemplates();
  const hiddenIds: string[] = hiddenData?.value ?? [];

  const { data: overridesData } = useSystemTemplateOverrides();
  const deleteOverrideMut = useDeleteSystemTemplateOverride();
  const overrides = overridesData?.value ?? {};
  const effectiveSystemTemplates = applyOverrides(overrides);

  const userTemplates = data?.items ?? [];
  const selectableMode = mode === "select";
  const [manualSystemOpen, setManualSystemOpen] = useState(selectableMode);
  const [manualUserOpen, setManualUserOpen] = useState(false);

  /** Toggle a system template's visibility (admin only). */
  function toggleHide(id: string) {
    const next = hiddenIds.includes(id)
      ? hiddenIds.filter((h) => h !== id)
      : [...hiddenIds, id];
    setHiddenMut.mutate(next);
  }

  // In non-admin views filter out hidden system templates
  const visibleSystemTemplates = isAdmin
    ? effectiveSystemTemplates
    : effectiveSystemTemplates.filter((t) => !hiddenIds.includes(t.id));
  const selectedSystemTemplate = Boolean(selectedId?.startsWith("sys-"));
  const selectedUserTemplate = Boolean(selectedId && !selectedId.startsWith("sys-"));
  const systemOpen = selectedSystemTemplate || manualSystemOpen;
  const userOpen = selectedUserTemplate || manualUserOpen;

  const systemTemplatesSection = (
    <div className="space-y-2">
      {!selectableMode && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          系统默认
        </p>
      )}
      {visibleSystemTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          当前没有可用的系统模板
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleSystemTemplates.map((tmpl) => {
            const isSelected = selectedId === tmpl.id;
            const isHidden = hiddenIds.includes(tmpl.id);
            return (
              <div
                key={tmpl.id}
                className={`group relative rounded-lg border-2 p-3 transition-colors ${
                  mode === "select" ? "cursor-pointer" : ""
                } ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : isHidden
                    ? "border-dashed border-muted-foreground/40 opacity-50"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => mode === "select" && onSelect?.(tmpl.canvas, tmpl.id, tmpl.name)}
              >
                <div className="mb-2 flex h-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {Math.round(tmpl.canvas.widthPx / 3.78)}×{Math.round(tmpl.canvas.heightPx / 3.78)} mm
                </div>
                <p className="truncate text-xs font-medium">{tmpl.name}</p>
                <p className="text-xs text-muted-foreground">{tmpl.description}</p>

                {selectableMode && canPreview && onPreview && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-7 w-7 opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    title="预览模板"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(tmpl.canvas, tmpl.name);
                    }}
                  >
                    <Eye className="size-3.5" />
                  </Button>
                )}

                {mode === "manage" && isAdmin && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/editor?seed=${tmpl.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                      title="编辑此系统模板"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="size-3" />
                    </Link>
                    {overrides[tmpl.id] && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-amber-600 hover:bg-amber-50"
                        title="恢复出厂默认"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`将「${tmpl.name}」恢复为出厂默认？`)) {
                            deleteOverrideMut.mutate(tmpl.id);
                          }
                        }}
                      >
                        <RotateCcw className="size-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-6 w-6 ${
                        isHidden
                          ? "text-amber-500 hover:bg-amber-50"
                          : "text-destructive hover:bg-destructive/10"
                      }`}
                      title={isHidden ? "显示此模板" : "对所有用户隐藏此模板"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHide(tmpl.id);
                      }}
                    >
                      <EyeOff className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const userTemplatesSection = (
    <div className="space-y-2">
      {!selectableMode && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            我的模板
          </p>
          {mode === "manage" && (
            <Link
              href="/editor"
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <Plus className="size-4" />
              新建模板
            </Link>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : userTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {mode === "manage"
            ? "暂无自定义模板，点击「新建模板」开始设计"
            : "暂无自定义模板"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {userTemplates.map((tmpl) => {
            const id = String(tmpl.id);
            const isSelected = selectedId === id;
            return (
              <div
                key={tmpl.id}
                className={`group relative cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => {
                  if (mode === "select") onSelect?.(recordToDefinition(tmpl), id, tmpl.name);
                }}
              >
                <div className="mb-2 flex h-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {Math.round(tmpl.canvas_width_px / 3.78)}×{Math.round(tmpl.canvas_height_px / 3.78)} mm
                </div>
                <p className="truncate text-xs font-medium">{tmpl.name}</p>
                <p className="text-xs text-muted-foreground">{tmpl.canvas_json.length} 个元素</p>

                {selectableMode && canPreview && onPreview && (
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-7 w-7 opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    title="预览模板"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(recordToDefinition(tmpl), tmpl.name);
                    }}
                  >
                    <Eye className="size-3.5" />
                  </Button>
                )}

                {mode === "manage" && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/editor/${tmpl.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="size-3" />
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`删除模板「${tmpl.name}」？此操作不可恢复`)) {
                          deleteMut.mutate({ id: tmpl.id });
                        }
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!selectableMode) {
    return (
      <div className="space-y-5">
        {systemTemplatesSection}
        {userTemplatesSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Collapsible open={systemOpen} onOpenChange={setManualSystemOpen} className="rounded-xl border bg-background p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <div>
            <p className="text-sm font-medium">系统默认</p>
            <p className="text-xs text-muted-foreground">{visibleSystemTemplates.length} 个可用模板</p>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", systemOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {systemTemplatesSection}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={userOpen} onOpenChange={setManualUserOpen} className="rounded-xl border bg-background p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <div>
            <p className="text-sm font-medium">我的模板</p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "正在加载模板…" : `${userTemplates.length} 个自定义模板`}
            </p>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", userOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {userTemplatesSection}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
