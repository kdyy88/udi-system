// Route-level loading skeleton for 批量打码
import { Skeleton } from "@/components/ui/skeleton";

export default function BatchLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <Skeleton className="h-7 w-32" />

      {/* Upload zone */}
      <div className="rounded-xl border-2 border-dashed p-10 flex flex-col items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Action bar */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Template section */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
