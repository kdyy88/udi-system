"use client";

import { DataTable } from "@/components/shared/DataTable";
import { LabelHistoryFilter } from "./LabelHistoryFilter";
import type { LabelHistoryItem } from "@/types/udi";

type LabelHistorySectionProps = {
  rows: LabelHistoryItem[];
  loading: boolean;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onSearch: (gtin: string, batchNo: string) => void;
  onReview: (row: LabelHistoryItem) => void;
  onDelete: (id: number) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function LabelHistorySection({
  rows,
  loading,
  total,
  hasPrev,
  hasNext,
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
          onDelete={onDelete}
          pagination={{
            total,
            hasPrev,
            hasNext,
            onPrev,
            onNext,
          }}
        />
      </div>
    </section>
  );
}
