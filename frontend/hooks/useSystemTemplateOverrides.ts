import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CanvasDefinition } from "@/types/template";

const BASE = "/api/v1/system";
const OVERRIDES_KEY = ["system", "template-overrides"];

type OverridesResponse = { value: Record<string, CanvasDefinition> };

/** Fetches all admin-saved canvas overrides for system templates. */
export function useSystemTemplateOverrides() {
  return useQuery<OverridesResponse>({
    queryKey: OVERRIDES_KEY,
    queryFn: () =>
      api.get<OverridesResponse>(`${BASE}/template-overrides`).then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Admin-only: saves (or replaces) the canvas for one system template. */
export function useSaveSystemTemplateOverride(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sysId, canvas }: { sysId: string; canvas: CanvasDefinition }) =>
      api
        .put<OverridesResponse>(
          `${BASE}/template-override/${sysId}`,
          {
            widthPx: canvas.widthPx,
            heightPx: canvas.heightPx,
            elements: canvas.elements,
          },
          { params: { user_id: userId } },
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(OVERRIDES_KEY, data);
    },
  });
}

/** Admin-only: removes the canvas override, restoring the factory default. */
export function useDeleteSystemTemplateOverride(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sysId: string) =>
      api
        .delete<OverridesResponse>(
          `${BASE}/template-override/${sysId}`,
          { params: { user_id: userId } },
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(OVERRIDES_KEY, data);
    },
  });
}
