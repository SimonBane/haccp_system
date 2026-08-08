import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Breadcrumb placeholder for a route's loading.tsx.
 *
 * The sidebar trigger stays real — it is rendered by the layout above the
 * suspense boundary and remains usable while the page resolves, so skeletoning
 * it would make the shell look broken rather than loading.
 */
export function DashboardLoadingHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="hidden h-4 w-4 md:block" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </header>
  );
}
