"use client";

import { Undo2, Redo2, Trash2, Magnet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasStore, makeBarcode, makeText, makeRect, MM_TO_PX_RATIO } from "@/stores/canvasStore";
import { pxToMm, mmToPx } from "@/types/template";

export function ElementToolbar() {
  const addElement = useCanvasStore((s) => s.addElement);
  const deleteElements = useCanvasStore((s) => s.deleteElements);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const widthPx = useCanvasStore((s) => s.widthPx);
  const heightPx = useCanvasStore((s) => s.heightPx);
  const setCanvasSize = useCanvasStore((s) => s.setCanvasSize);

  const snapEnabled = useCanvasStore((s) => s.snapEnabled);
  const gridPx = useCanvasStore((s) => s.gridPx);
  const toggleSnap = useCanvasStore((s) => s.toggleSnap);
  const setGridPx = useCanvasStore((s) => s.setGridPx);

  const handleUndo = () => useCanvasStore.temporal.getState().undo();
  const handleRedo = () => useCanvasStore.temporal.getState().redo();

  // Pre-computed grid presets (px values ≈ 1mm / 2mm / 5mm)
  const GRID_OPTIONS = [
    { label: "1 mm", value: Math.round(MM_TO_PX_RATIO * 1) },
    { label: "2 mm", value: Math.round(MM_TO_PX_RATIO * 2) },
    { label: "5 mm", value: Math.round(MM_TO_PX_RATIO * 5) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas size inputs */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">画布尺寸</p>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Input
              type="number"
              min={10}
              max={2000}
              step={1}
              value={Math.round(pxToMm(widthPx) * 10) / 10}
              onChange={(e) => {
                const mm = parseFloat(e.target.value);
                if (!isNaN(mm) && mm > 0) setCanvasSize(mmToPx(mm), heightPx);
              }}
              className="h-8 pr-8 text-sm"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              mm
            </span>
          </div>
          <span className="text-muted-foreground">×</span>
          <div className="relative flex-1">
            <Input
              type="number"
              min={10}
              max={2000}
              step={1}
              value={Math.round(pxToMm(heightPx) * 10) / 10}
              onChange={(e) => {
                const mm = parseFloat(e.target.value);
                if (!isNaN(mm) && mm > 0) setCanvasSize(widthPx, mmToPx(mm));
              }}
              className="h-8 pr-8 text-sm"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              mm
            </span>
          </div>
        </div>
      </div>

      {/* Add element buttons */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">添加元素</p>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => addElement(makeBarcode("datamatrix"))}
          >
            ▦ DataMatrix 条码
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => addElement(makeBarcode("gs1128"))}
          >
            ▬ GS1-128 条码
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => addElement(makeText())}
          >
            T 文本
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => addElement(makeRect())}
          >
            □ 矩形
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">操作</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleUndo} title="撤销">
            <Undo2 className="size-4" />
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleRedo} title="重做">
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-destructive hover:bg-destructive/10"
            disabled={selectedIds.length === 0}
            onClick={() => selectedIds.length > 0 && deleteElements(selectedIds)}
            title={selectedIds.length > 1 ? `删除 ${selectedIds.length} 个元素` : "删除选中元素"}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grid / Snap */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">网格吸附</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={snapEnabled ? "default" : "outline"}
            className="shrink-0"
            onClick={toggleSnap}
            title={snapEnabled ? "关闭吸附" : "开启吸附"}
          >
            <Magnet className="size-4" />
          </Button>
          <select
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
            value={gridPx}
            disabled={!snapEnabled}
            onChange={(e) => setGridPx(Number(e.target.value))}
          >
            {GRID_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
