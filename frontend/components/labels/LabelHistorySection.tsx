"use client";

import { DataTable } from "@/components/shared/DataTable";
import { LabelHistoryFilter } from "./LabelHistoryFilter";
import type { LabelHistoryItem } from "@/types/udi";

type LabelHistorySectionProps = {
  rows: LabelHistoryItem[];
  loading: boolean;
  loadingReviewId: number | null;
  page: number;
  pageSize: number;
  total: number;
  onSearch: (gtin: string, batchNo: string) => void;
  onReview: (row: LabelHistoryItem) => void;
  onDelete: (id: number, onSuccess: () => void) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function LabelHistorySection({
  rows,
  loading,
  loadingReviewId,
  page,
  pageSize,
  total,
  onSearch,
  onReview,
  onDelete,
  onPrev,
  onNext,
}: LabelHistorySectionProps) {
  return (
    <section className="rounded-xl border p-4 sm:p-5">
      <LabelHistoryFilter onSearch={onSearch} isLoading={loading} />

      <div className="mt-4">
        <DataTable
          rows={rows}
          onReview={onReview}
          onDelete={(id) => onDelete(id, () => onSearch("", ""))}
          loadingRowId={loadingReviewId}
          pagination={{
            page,
            pageSize,
            total,
            onPrev,
            onNext,
          }}
        />
      </div>
    </section>
  );
}
