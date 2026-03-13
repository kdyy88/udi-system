"use client";

type BarcodePreviewProps = {
  base64Png?: string;
};

export function BarcodePreview({ base64Png }: BarcodePreviewProps) {
  if (!base64Png) {
    return (
      <section className="rounded-lg border p-4 text-sm text-muted-foreground">
        条码预览区（暂无数据）
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${base64Png}`}
        alt="GS1 Barcode Preview"
        className="max-w-full"
      />
    </section>
  );
}
