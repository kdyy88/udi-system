export function findAiText(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)[^()]+`))?.[0] ?? "";
}

export function findAiValue(hri: string, ai: string): string {
  return hri.match(new RegExp(`\\(${ai}\\)([^()]+)`))?.[1] ?? "";
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
