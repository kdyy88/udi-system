"use client";

import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore, barcodeAspectRatio } from "@/stores/canvasStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { pxToMm, mmToPx, GS1_AI_LABELS, type GS1AiField, type BarcodeType } from "@/types/template";

export function PropertiesPanel() {
  const selectedIds = useCanvasStore(useShallow((s) => s.selectedIds));
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const widthPx = useCanvasStore((s) => s.widthPx);
  const heightPx = useCanvasStore((s) => s.heightPx);

  // ── Multi-select: relative alignment panel ───────────────────────────────
  if (selectedIds.length > 1) {
    const selected = elements.filter((e) => selectedIds.includes(e.id));

    // Bounding-box edges
    const minX  = Math.min(...selected.map((e) => e.x));
    const minY  = Math.min(...selected.map((e) => e.y));
    const maxX  = Math.max(...selected.map((e) => e.x + e.w));
    const maxY  = Math.max(...selected.map((e) => e.y + e.h));
    const midX  = (minX + maxX) / 2;
    const midY  = (minY + maxY) / 2;

    // Align relative to each other (bounding-box edges / center)
    const alignLeft    = () => selected.forEach((e) => updateElement(e.id, { x: minX }));
    const alignCenterH = () => selected.forEach((e) => updateElement(e.id, { x: Math.round(midX - e.w / 2) }));
    const alignRight   = () => selected.forEach((e) => updateElement(e.id, { x: maxX - e.w }));
    const alignTop     = () => selected.forEach((e) => updateElement(e.id, { y: minY }));
    const alignCenterV = () => selected.forEach((e) => updateElement(e.id, { y: Math.round(midY - e.h / 2) }));
    const alignBottom  = () => selected.forEach((e) => updateElement(e.id, { y: maxY - e.h }));

    // Distribute: sort by position, spread evenly
    const distributeH = () => {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const totalW  = sorted.reduce((s, e) => s + e.w, 0);
      const gap     = (maxX - minX - totalW) / (sorted.length - 1);
      let cursor = minX;
      sorted.forEach((e) => {
        updateElement(e.id, { x: Math.round(cursor) });
        cursor += e.w + gap;
      });
    };
    const distributeV = () => {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const totalH  = sorted.reduce((s, e) => s + e.h, 0);
      const gap     = (maxY - minY - totalH) / (sorted.length - 1);
      let cursor = minY;
      sorted.forEach((e) => {
        updateElement(e.id, { y: Math.round(cursor) });
        cursor += e.h + gap;
      });
    };

    return (
      <div className="space-y-4 text-sm">
        <p className="text-xs text-muted-foreground">已选中 {selectedIds.length} 个元素</p>

        <Section title="相对对齐">
          <p className="text-xs text-muted-foreground">水平</p>
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant="outline" title="左边对齐" onClick={alignLeft}>
              <AlignStartVertical className="size-4" />
            </Button>
            <Button size="sm" variant="outline" title="水平轴居中对齐" onClick={alignCenterH}>
              <AlignCenterVertical className="size-4" />
            </Button>
            <Button size="sm" variant="outline" title="右边对齐" onClick={alignRight}>
              <AlignEndVertical className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">垂直</p>
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant="outline" title="顶边对齐" onClick={alignTop}>
              <AlignStartHorizontal className="size-4" />
            </Button>
            <Button size="sm" variant="outline" title="垂直轴居中对齐" onClick={alignCenterV}>
              <AlignCenterHorizontal className="size-4" />
            </Button>
            <Button size="sm" variant="outline" title="底边对齐" onClick={alignBottom}>
              <AlignEndHorizontal className="size-4" />
            </Button>
          </div>
        </Section>

        {selectedIds.length >= 3 && (
          <Section title="等距分布">
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" title="水平等距" onClick={distributeH}>
                <AlignHorizontalDistributeCenter className="size-4" />
                <span className="ml-1 text-xs">水平</span>
              </Button>
              <Button size="sm" variant="outline" title="垂直等距" onClick={distributeV}>
                <AlignVerticalDistributeCenter className="size-4" />
                <span className="ml-1 text-xs">垂直</span>
              </Button>
            </div>
          </Section>
        )}
      </div>
    );
  }

  // ── Single-select: show element properties ───────────────────────────────
  const el = elements.find((e) => e.id === selectedIds[0]);

  if (!el) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground px-2">
        点击选中元素<br />Shift+点击 多选
      </div>
    );
  }

  const update = (patch: Parameters<typeof updateElement>[1]) => updateElement(el.id, patch);

  // Aspect ratio constraint for barcode elements
  const aspectRatio = el.type === "barcode" ? barcodeAspectRatio(el.barcodeType) : false;

  const handleWidthChange = (mm: number) => {
    const wPx = mmToPx(mm);
    if (aspectRatio !== false) {
      update({ w: wPx, h: Math.round(wPx / aspectRatio) });
    } else {
      update({ w: wPx });
    }
  };

  const handleHeightChange = (mm: number) => {
    const hPx = mmToPx(mm);
    if (aspectRatio !== false) {
      update({ h: hPx, w: Math.round(hPx * aspectRatio) });
    } else {
      update({ h: hPx });
    }
  };

  const aspectLabel = aspectRatio !== false
    ? aspectRatio === 1
      ? "比例锁定 1:1（宽:高）"
      : `比例锁定 ${aspectRatio}:1（宽:高）`
    : null;

  const alignH = (mode: "left" | "center" | "right") => {
    if (mode === "left") update({ x: 0 });
    else if (mode === "center") update({ x: Math.round((widthPx - el.w) / 2) });
    else update({ x: widthPx - el.w });
  };
  const alignV = (mode: "top" | "middle" | "bottom") => {
    if (mode === "top") update({ y: 0 });
    else if (mode === "middle") update({ y: Math.round((heightPx - el.h) / 2) });
    else update({ y: heightPx - el.h });
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Level 3: Alignment to canvas */}
      <Section title="对齐到画布">
        <div className="grid grid-cols-3 gap-1">
          <Button size="sm" variant="outline" title="左对齐" onClick={() => alignH("left")}>
            <AlignHorizontalJustifyStart className="size-4" />
          </Button>
          <Button size="sm" variant="outline" title="水平居中" onClick={() => alignH("center")}>
            <AlignHorizontalJustifyCenter className="size-4" />
          </Button>
          <Button size="sm" variant="outline" title="右对齐" onClick={() => alignH("right")}>
            <AlignHorizontalJustifyEnd className="size-4" />
          </Button>
          <Button size="sm" variant="outline" title="顶部对齐" onClick={() => alignV("top")}>
            <AlignVerticalJustifyStart className="size-4" />
          </Button>
          <Button size="sm" variant="outline" title="垂直居中" onClick={() => alignV("middle")}>
            <AlignVerticalJustifyCenter className="size-4" />
          </Button>
          <Button size="sm" variant="outline" title="底部对齐" onClick={() => alignV("bottom")}>
            <AlignVerticalJustifyEnd className="size-4" />
          </Button>
        </div>
      </Section>

      {/* Common: position and size */}
      <Section title="位置与尺寸">
        <Row label="X (mm)">
          <NumInput value={pxToMm(el.x)} onChange={(mm) => update({ x: mmToPx(mm) })} />
        </Row>
        <Row label="Y (mm)">
          <NumInput value={pxToMm(el.y)} onChange={(mm) => update({ y: mmToPx(mm) })} />
        </Row>
        <Row label={aspectRatio !== false ? "宽 (mm) →" : "宽 (mm)"}>
          <NumInput value={pxToMm(el.w)} min={1} onChange={handleWidthChange} />
        </Row>
        <Row label={aspectRatio !== false ? "高 (mm) →" : "高 (mm)"}>
          <NumInput value={pxToMm(el.h)} min={1} onChange={handleHeightChange} />
        </Row>
        {aspectLabel && (
          <p className="text-xs text-muted-foreground">{aspectLabel}</p>
        )}
      </Section>

      {/* Barcode-specific */}
      {el.type === "barcode" && (
        <Section title="条码设置">
          <Row label="类型">
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={el.barcodeType}
              onChange={(e) => {
                const bt = e.target.value as BarcodeType;
                const ar = barcodeAspectRatio(bt);
                if (ar !== false) {
                  // Keep width, recalculate height to satisfy new ratio
                  update({ barcodeType: bt, h: Math.round(el.w / ar) });
                } else {
                  update({ barcodeType: bt });
                }
              }}
            >
              <option value="datamatrix">DataMatrix</option>
              <option value="gs1128">GS1-128 (全部)</option>
              <option value="gs1128_di">GS1-128 DI</option>
              <option value="gs1128_pi">GS1-128 PI</option>
            </select>
          </Row>
        </Section>
      )}

      {/* Text-specific */}
      {el.type === "text" && (
        <Section title="文本设置">
          <Row label="字段绑定">
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={el.fieldBinding ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update({ fieldBinding: v === "" ? null : (v as GS1AiField) });
              }}
            >
              <option value="">静态文本</option>
              {(Object.entries(GS1_AI_LABELS) as [GS1AiField, string][]).map(([ai, label]) => (
                <option key={ai} value={ai}>{label}</option>
              ))}
            </select>
          </Row>
          {!el.fieldBinding && (
            <Row label="内容">
              <Input
                className="h-7 text-sm"
                value={el.content}
                onChange={(e) => update({ content: e.target.value })}
              />
            </Row>
          )}
          <Row label="字号 (px)">
            <NumInput value={el.fontSize} min={6} max={200} step={1} onChange={(v) => update({ fontSize: v })} />
          </Row>
          <Row label="加粗">
            <input
              type="checkbox"
              checked={el.fontWeight === "bold"}
              onChange={(e) => update({ fontWeight: e.target.checked ? "bold" : "normal" })}
            />
          </Row>
          <Row label="对齐">
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={el.textAlign}
              onChange={(e) => update({ textAlign: e.target.value as "left" | "center" | "right" })}
            >
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </Row>
        </Section>
      )}

      {/* Rect-specific */}
      {el.type === "rect" && (
        <Section title="矩形设置">
          <Row label="填充">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={el.fill !== "none"}
                onChange={(e) => update({ fill: e.target.checked ? "#ffffff" : "none" })}
              />
              {el.fill !== "none" && (
                <input
                  type="color"
                  value={el.fill}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="h-6 w-10 cursor-pointer rounded border"
                />
              )}
            </div>
          </Row>
          <Row label="边框色">
            <input
              type="color"
              value={el.stroke}
              onChange={(e) => update({ stroke: e.target.value })}
              className="h-6 w-10 cursor-pointer rounded border"
            />
          </Row>
          <Row label="边框粗细">
            <NumInput value={el.strokeWidth} min={0} max={20} step={0.5} onChange={(v) => update({ strokeWidth: v })} />
          </Row>
        </Section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  min,
  max,
  step = 0.5,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      type="number"
      className="h-7 text-sm"
      value={Math.round(value * 10) / 10}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
    />
  );
}
