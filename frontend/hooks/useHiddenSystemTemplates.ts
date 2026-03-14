import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const BASE = "/api/v1/system/hidden-templates";
const QUERY_KEY = ["system", "hidden-templates"];

type HiddenTemplatesResponse = { value: string[] };

/** Returns the list of system-template IDs currently hidden by an admin. */
export function useHiddenSystemTemplates() {
  return useQuery<HiddenTemplatesResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<HiddenTemplatesResponse>(BASE).then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Admin-only: replace the hidden-templates list. */
export function useSetHiddenSystemTemplates(userId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newHiddenIds: string[]) =>
      api
        .put<HiddenTemplatesResponse>(BASE, { value: newHiddenIds }, { params: { user_id: userId } })
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
    },
  });
}
