import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskTemplatesPageSkeleton } from "@/features/task-templates/components/task-templates-page-skeleton";

export default function TaskTemplatesLoading() {
  return (
    <>
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
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <TaskTemplatesPageSkeleton />
      </div>
    </>
  );
}
