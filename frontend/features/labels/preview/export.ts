import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";

export type PreviewExportFormat = "png" | "svg" | "pdf";

function downloadByDataUrl(dataUrl: string, filename: string) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const isBase64 = header.includes(";base64");

  let blob: Blob;
  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = new Blob([decodeURIComponent(data)], { type: mime });
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

export async function exportPreviewNode(
  node: HTMLElement,
  template: string,
  format: PreviewExportFormat
) {
  if (format === "png") {
    const dataUrl = await toPng(node, {
      backgroundColor: "transparent",
      pixelRatio: 2,
      cacheBust: true,
    });
    downloadByDataUrl(dataUrl, `udi-${template}.png`);
    return;
  }

  if (format === "svg") {
    const dataUrl = await toSvg(node, {
      backgroundColor: "transparent",
      cacheBust: true,
    });
    downloadByDataUrl(dataUrl, `udi-${template}.svg`);
    return;
  }

  const pngDataUrl = await toPng(node, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    cacheBust: true,
  });

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("load image failed"));
    image.src = pngDataUrl;
  });

  const pdf = new jsPDF({
    orientation: image.width > image.height ? "landscape" : "portrait",
    unit: "pt",
    format: [image.width, image.height],
  });
  pdf.addImage(pngDataUrl, "PNG", 0, 0, image.width, image.height);
  pdf.save(`udi-${template}.pdf`);
}
