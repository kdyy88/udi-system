"use client";

import { Undo2, Redo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasStore, makeBarcode, makeText, makeRect } from "@/stores/canvasStore";
import { pxToMm, mmToPx } from "@/types/template";

export function ElementToolbar() {
  const addElement = useCanvasStore((s) => s.addElement);
  const deleteElement = useCanvasStore((s) => s.deleteElement);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const widthPx = useCanvasStore((s) => s.widthPx);
  const heightPx = useCanvasStore((s) => s.heightPx);
  const setCanvasSize = useCanvasStore((s) => s.setCanvasSize);

  const handleUndo = () => useCanvasStore.temporal.getState().undo();
  const handleRedo = () => useCanvasStore.temporal.getState().redo();

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
            disabled={!selectedId}
            onClick={() => selectedId && deleteElement(selectedId)}
            title="删除选中元素"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
