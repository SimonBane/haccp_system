import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for a resource list.
 *
 * Renders as cards on mobile and rows on desktop, matching what DataTable
 * actually swaps in, so the layout does not jump when the data lands.
 */
export function DataTableSkeleton({
  rows = 6,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  const rowKeys = Array.from({ length: rows }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="space-y-3 rounded-lg bg-sidebar p-4 ring-1 ring-sidebar-border">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-full max-w-64" />
          <Skeleton className="h-9 w-28" />
        </div>

        {/* Desktop rows */}
        <div className="hidden md:block">
          {rowKeys.map((row) => (
            <div
              key={row}
              className="flex items-center gap-4 border-b py-3 last:border-b-0"
            >
              {Array.from({ length: columns }, (_, col) => (
                <Skeleton
                  key={col}
                  className="h-4 flex-1"
                  style={{ maxWidth: col === 0 ? undefined : "8rem" }}
                />
              ))}
              <Skeleton className="size-8 shrink-0 rounded-md" />
            </div>
          ))}
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {rowKeys.map((row) => (
            <div key={row} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="size-8 shrink-0 rounded-md" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
