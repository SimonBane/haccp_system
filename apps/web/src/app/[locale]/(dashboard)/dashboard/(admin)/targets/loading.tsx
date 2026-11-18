import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function TargetsLoading() {
  return (
    <PageContainer width="content">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <div className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-9 w-full sm:w-[250px]" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
