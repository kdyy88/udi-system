// Route-level loading skeleton for the homepage (标签生成)
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      {/* Page header */}
      <Skeleton className="h-8 w-36" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Form card */}
        <div className="space-y-4 rounded-xl border p-6">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-full mt-2" />
        </div>

        {/* Preview panel */}
        <div className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>

      {/* History tabs */}
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </main>
  );
}
