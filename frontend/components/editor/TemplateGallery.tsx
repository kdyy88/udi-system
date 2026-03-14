"use client";

import Link from "next/link";
import { Pencil, Trash2, Plus, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListTemplates, useDeleteTemplate } from "@/hooks/useLabelTemplates";
import { useHiddenSystemTemplates, useSetHiddenSystemTemplates } from "@/hooks/useHiddenSystemTemplates";
import { useSystemTemplateOverrides, useDeleteSystemTemplateOverride } from "@/hooks/useSystemTemplateOverrides";
import { recordToDefinition, type CanvasDefinition } from "@/types/template";
import { applyOverrides, SYSTEM_TEMPLATES } from "@/lib/systemTemplates";

type Mode = "manage" | "select";

type Props = {
  userId: number;
  mode: Mode;
  /** Whether the current user is an admin (may edit/hide system templates). */
  isAdmin?: boolean;
  /** Selected template ID — "sys-xxx" for system templates, numeric string for user templates */
  selectedId?: string | null;
  onSelect?: (def: CanvasDefinition, id: string) => void;
};

export function TemplateGallery({ userId, mode, isAdmin = false, selectedId, onSelect }: Props) {
  const { data, isLoading } = useListTemplates(userId);
  const deleteMut = useDeleteTemplate();

  const { data: hiddenData } = useHiddenSystemTemplates();
  const setHiddenMut = useSetHiddenSystemTemplates(userId);
  const hiddenIds: string[] = hiddenData?.value ?? [];

  const { data: overridesData } = useSystemTemplateOverrides();
  const deleteOverrideMut = useDeleteSystemTemplateOverride(userId);
  const overrides = overridesData?.value ?? {};
  const effectiveSystemTemplates = applyOverrides(overrides);

  const userTemplates = data?.items ?? [];

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

  return (
    <div className="space-y-5">
      {/* ── System templates ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          系统默认
        </p>
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
                onClick={() => mode === "select" && onSelect?.(tmpl.canvas, tmpl.id)}
              >
                <div className="mb-2 flex h-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {Math.round(tmpl.canvas.widthPx / 3.78)}×{Math.round(tmpl.canvas.heightPx / 3.78)} mm
                </div>
                <p className="truncate text-xs font-medium">{tmpl.name}</p>
                <p className="text-xs text-muted-foreground">{tmpl.description}</p>

                {/* Admin controls for system templates */}
                {mode === "manage" && isAdmin && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* Edit: open editor seeded with this template */}
                    <Link
                      href={`/editor?seed=${tmpl.id}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                      title="编辑此系统模板"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="size-3" />
                    </Link>
                    {/* Reset override to factory default (only shown when override exists) */}
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
                    {/* Hide/show toggle */}
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
      </div>

      {/* ── User templates ─────────────────────────────────────────────── */}
      <div className="space-y-2">
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
                    if (mode === "select") onSelect?.(recordToDefinition(tmpl), id);
                  }}
                >
                  <div className="mb-2 flex h-16 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                    {Math.round(tmpl.canvas_width_px / 3.78)}×{Math.round(tmpl.canvas_height_px / 3.78)} mm
                  </div>
                  <p className="truncate text-xs font-medium">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tmpl.canvas_json.length} 个元素</p>

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
                            deleteMut.mutate({ id: tmpl.id, userId });
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
    </div>
  );
}
