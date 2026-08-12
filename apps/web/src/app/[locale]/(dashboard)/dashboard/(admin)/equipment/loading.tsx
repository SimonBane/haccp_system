import { PageContainer } from "@/components/layout/page-container";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";

export default function EquipmentLoading() {
  return (
    <PageContainer width="content">
      <DataTableSkeleton columns={3} />
    </PageContainer>
  );
}
