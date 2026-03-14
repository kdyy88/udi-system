"use client";

import { useCanvasStore, barcodeAspectRatio } from "@/stores/canvasStore";
import { Input } from "@/components/ui/input";
import { pxToMm, mmToPx, GS1_AI_LABELS, type GS1AiField, type BarcodeType } from "@/types/template";

export function PropertiesPanel() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const elements = useCanvasStore((s) => s.elements);
  const updateElement = useCanvasStore((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        选中元素后在此查看属性
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

  return (
    <div className="space-y-4 text-sm">
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
