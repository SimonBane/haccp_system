"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { getColumns } from "@/features/equipment/data-table/columns";

type EquipmentDataProps = {
  items: EquipmentResponse[];
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

export function EquipmentData({
  items,
  onEdit,
  onDuplicate,
  onDelete,
}: EquipmentDataProps) {
  const t = useTranslations("EquipmentPage");

  const typeLabels: Record<EquipmentType, string> = {
    fridge: t("types.fridge"),
    freezer: t("types.freezer"),
    display_case: t("types.displayCase"),
  };

  const columns = useMemo(
    () =>
      getColumns({
        t,
        typeLabels,
        onEdit,
        onDuplicate,
        onDelete,
      }),
    [t, typeLabels, onEdit, onDuplicate, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      emptyMessage={t("emptyTitle")}
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onEdit(row.original)}
    />
  );
}
