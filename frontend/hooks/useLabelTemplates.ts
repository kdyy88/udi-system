import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery, type InfiniteData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LabelTemplateRecord, TemplateListResponse, CanvasDefinition } from "@/types/template";

const BASE = "/api/v1/templates";
const DEFAULT_PAGE_SIZE = 24;

type QueryOptions = {
  enabled?: boolean;
  pageSize?: number;
  fetchAll?: boolean;
};

async function fetchTemplatePage(cursor: number | null, pageSize: number): Promise<TemplateListResponse> {
  return api.get<TemplateListResponse>(BASE, {
    params: {
      cursor: cursor ?? undefined,
      page_size: pageSize,
    },
  }).then((r) => r.data);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListTemplates(options?: QueryOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const query = useInfiniteQuery<TemplateListResponse, Error, InfiniteData<TemplateListResponse>, [string, number], number | null>({
    queryKey: ["templates", pageSize],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => fetchTemplatePage(pageParam, pageSize),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: options?.enabled ?? true,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? items.length;
  const nextCursor = query.data?.pages[query.data.pages.length - 1]?.next_cursor ?? null;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (options?.fetchAll && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [options?.fetchAll, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    ...query,
    data: {
      total,
      next_cursor: nextCursor,
      items,
    },
    items,
    total,
    nextCursor,
  };
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
