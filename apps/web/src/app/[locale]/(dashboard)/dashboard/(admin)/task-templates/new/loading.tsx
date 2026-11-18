import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaskBuilderLoading() {
  return (
    <PageContainer width="content">
      <Skeleton className="h-14 w-full" />
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-72" />
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
        </div>
        <div className="flex flex-col gap-4 max-lg:hidden">
          <Skeleton className="h-64" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </PageContainer>
  );
}
