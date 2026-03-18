// Route-level loading skeleton for 历史台账
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10">
      <Skeleton className="h-7 w-40" />
      {/* Tab bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
      {/* Filter bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Table rows */}
      <div className="rounded-xl border overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
        ))}
      </div>
    </main>
  );
}
