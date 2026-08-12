import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationLoading() {
  return (
    <PageContainer width="narrow">
      <div className="hidden md:block">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      {/* Three independent settings sections, each its own card. */}
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-4 rounded-lg border p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-9 w-full max-w-sm" />
        </div>
      ))}
    </PageContainer>
  );
}
