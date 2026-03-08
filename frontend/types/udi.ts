export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export type AuthUser = {
  user_id: number;
  username: string;
};

export type LoginResponse = {
  user_id: number;
  username: string;
  message: string;
};

export type LabelPreviewResponse = {
  di: string;
  hri: string;
  gs1_element_string: string;
  gs1_element_string_escaped: string;
  datamatrix_base64: string;
  gs1_128_base64: string;
};

export type LabelGenerateResponse = LabelPreviewResponse & {
  history_id: number;
  created_at: string;
};

export type LabelPreviewSvgResponse = {
  di: string;
  hri: string;
  gs1_element_string: string;
  gs1_element_string_escaped: string;
  datamatrix_svg: string;
  gs1_128_svg: string;
};

export type LabelHistoryItem = {
  id: number;
  user_id: number;
  gtin: string;
  batch_no: string | null;
  expiry_date: string | null;
  serial_no: string | null;
  production_date: string | null;
  remarks: string | null;
  full_string: string;
  hri: string;
  datamatrix_base64: string;
  gs1_128_base64: string;
  created_at: string;
};

export type LabelHistoryListResponse = {
  total: number;
  page: number;
  page_size: number;
  items: LabelHistoryItem[];
};
