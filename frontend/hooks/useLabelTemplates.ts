import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LabelTemplateRecord, TemplateListResponse, CanvasDefinition } from "@/types/template";

const BASE = "/api/v1/templates";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListTemplates() {
  return useQuery<TemplateListResponse>({
    queryKey: ["templates"],
    queryFn: () =>
      api.get<TemplateListResponse>(BASE).then((r) => r.data),
    enabled: true,
  });
}

export function useGetTemplate(id: number) {
  return useQuery<LabelTemplateRecord>({
    queryKey: ["template", id],
    queryFn: () =>
      api.get<LabelTemplateRecord>(`${BASE}/${id}`).then((r) => r.data),
    enabled: id > 0,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type CreatePayload = {
  name: string;
  description?: string;
  canvas: CanvasDefinition;
};

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description, canvas }: CreatePayload) =>
      api
        .post<LabelTemplateRecord>(
          BASE,
          {
            name,
            description: description ?? null,
            canvas_width_px: canvas.widthPx,
            canvas_height_px: canvas.heightPx,
            canvas_json: canvas.elements,
          },
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

type UpdatePayload = {
  id: number;
  name?: string;
  description?: string;
  canvas?: CanvasDefinition;
};

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, description, canvas }: UpdatePayload) =>
      api
        .put<LabelTemplateRecord>(`${BASE}/${id}`, {
          name,
          description,
          canvas_width_px: canvas?.widthPx,
          canvas_height_px: canvas?.heightPx,
          canvas_json: canvas?.elements,
        })
        .then((r) => r.data),
    onSuccess: (data, vars) => {
      qc.setQueryData(["template", vars.id], data);
      void qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      api.delete(`${BASE}/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
