export type TemplateKey = "compact" | "dual" | "detail";

export type PreviewTemplateDefinition = {
  key: TemplateKey;
  label: string;
  description: string;
};

export const PREVIEW_TEMPLATES: PreviewTemplateDefinition[] = [
  {
    key: "compact",
    label: "紧凑",
    description: "DataMatrix + 关键 AI 文本，适用于最小标签面。",
  },
  {
    key: "dual",
    label: "双码",
    description: "GS1-128 + DataMatrix 组合，适用于物流与临床混用。",
  },
  {
    key: "detail",
    label: "明细",
    description: "包含业务字段说明与双码展示，适用于出厂/质检单。",
  },
];

export const DEFAULT_TEMPLATE_KEY: TemplateKey = "compact";
