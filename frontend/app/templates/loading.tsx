// Route-level loading skeleton for 标签模板
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border overflow-hidden">
            <Skeleton className="h-36 w-full rounded-none" />
            <div className="p-3 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
