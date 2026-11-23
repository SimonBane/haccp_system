import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditFormLoading() {
  return (
    <PageContainer width="full" className="md:pt-0">
      <Skeleton className="h-12 w-full" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <Skeleton className="hidden h-96 xl:block" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-[28rem]" />
      </div>
    </PageContainer>
  );
}
