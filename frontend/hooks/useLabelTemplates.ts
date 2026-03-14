import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LabelTemplateRecord, TemplateListResponse, CanvasDefinition } from "@/types/template";

const BASE = "/api/v1/templates";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListTemplates(userId: number) {
  return useQuery<TemplateListResponse>({
    queryKey: ["templates", userId],
    queryFn: () =>
      api.get<TemplateListResponse>(BASE, { params: { user_id: userId } }).then((r) => r.data),
    enabled: userId > 0,
  });
}

export function useGetTemplate(id: number, userId: number) {
  return useQuery<LabelTemplateRecord>({
    queryKey: ["template", id],
    queryFn: () =>
      api.get<LabelTemplateRecord>(`${BASE}/${id}`, { params: { user_id: userId } }).then((r) => r.data),
    enabled: id > 0 && userId > 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type CreatePayload = {
  userId: number;
  name: string;
  description?: string;
  canvas: CanvasDefinition;
};

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, name, description, canvas }: CreatePayload) =>
      api
        .post<LabelTemplateRecord>(
          `${BASE}?user_id=${userId}`,
          {
            name,
            description: description ?? null,
            canvas_width_px: canvas.widthPx,
            canvas_height_px: canvas.heightPx,
            canvas_json: canvas.elements,
          },
        )
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["templates", vars.userId] });
    },
  });
}

type UpdatePayload = {
  id: number;
  userId: number;
  name?: string;
  description?: string;
  canvas?: CanvasDefinition;
};

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, name, description, canvas }: UpdatePayload) =>
      api
        .put<LabelTemplateRecord>(`${BASE}/${id}?user_id=${userId}`, {
          name,
          description,
          canvas_width_px: canvas?.widthPx,
          canvas_height_px: canvas?.heightPx,
          canvas_json: canvas?.elements,
        })
        .then((r) => r.data),
    onSuccess: (data, vars) => {
      qc.setQueryData(["template", vars.id], data);
      void qc.invalidateQueries({ queryKey: ["templates", vars.userId] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      api.delete(`${BASE}/${id}?user_id=${userId}`),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["templates", vars.userId] });
    },
  });
}
