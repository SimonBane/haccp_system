import { DashboardLoadingHeader } from "@/components/layout/dashboard-loading-header";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";

export default function EmployeesLoading() {
  return (
    <>
      <DashboardLoadingHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <DataTableSkeleton columns={4} />
      </div>
    </>
  );
}
