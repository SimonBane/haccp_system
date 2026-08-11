"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { MobileListSwipeAction } from "@/components/ui/data-table/data-table-mobile-list";
import { getColumns } from "@/features/equipment/data-table/columns";
import { EquipmentMobileCard } from "@/features/equipment/data-table/mobile-card";

type EquipmentDataProps = {
  items: EquipmentResponse[];
  onAdd: () => void;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

export function EquipmentData({
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
}: EquipmentDataProps) {
  const t = useTranslations("EquipmentPage");
  const tTable = useTranslations("DataTable");

  const typeLabels = useMemo<Record<EquipmentType, string>>(
    () => ({
      fridge: t("types.fridge"),
      freezer: t("types.freezer"),
      display_case: t("types.displayCase"),
    }),
    [t],
  );

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

  const renderSwipeActions = useCallback(
    (row: { original: EquipmentResponse }) => (
      <>
        <MobileListSwipeAction
          label={t("edit")}
          icon={<PencilIcon className="size-4" />}
          onClick={() => onEdit(row.original)}
        />
        <MobileListSwipeAction
          label={t("delete")}
          icon={<Trash2Icon className="size-4" />}
          variant="destructive"
          onClick={() => onDelete(row.original)}
        />
      </>
    ),
    [onDelete, onEdit, t],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof EquipmentMobileCard>[0]["row"]) => (
      <EquipmentMobileCard
        row={row}
        t={t}
        typeLabels={typeLabels}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    ),
    [t, typeLabels, onEdit, onDuplicate, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="name"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      emptyAction={
        <DataTableAddButton onClick={onAdd} label={t("add")} />
      }
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      toolbar={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      onRowClick={(row) => onEdit(row.original)}
      renderMobileRow={renderMobileRow}
      renderSwipeActions={renderSwipeActions}
    />
  );
}
