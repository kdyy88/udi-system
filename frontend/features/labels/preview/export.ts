import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";

export type PreviewExportFormat = "png" | "svg" | "pdf";

function downloadByDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
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
