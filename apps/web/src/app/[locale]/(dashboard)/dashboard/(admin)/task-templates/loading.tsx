import { DashboardLoadingHeader } from "@/components/layout/dashboard-loading-header";
import { PageContainer } from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";

export default function TaskTemplatesLoading() {
  return (
    <>
      <DashboardLoadingHeader />
      <PageContainer width="content">
        <DataTableSkeleton columns={4} />
      </PageContainer>
    </>
  );
}
