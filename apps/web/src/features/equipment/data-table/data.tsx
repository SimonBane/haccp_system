"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/equipment/data-table/columns";
import { EquipmentMobileCard } from "@/features/equipment/data-table/mobile-card";
import { getEquipmentRowActions } from "@/features/equipment/data-table/row-actions";

type EquipmentDataProps = {
  items: EquipmentResponse[];
  onAdd: () => void;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
  onBulkDelete: () => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

export function EquipmentData({
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onBulkDelete,
  rowSelection,
  onRowSelectionChange,
}: EquipmentDataProps) {
  const t = useTranslations("EquipmentPage");
  const tTable = useTranslations("DataTable");
  const selectedCount = useMemo(
    () => Object.values(rowSelection).filter(Boolean).length,
    [rowSelection],
  );

  const typeLabels = useMemo<Record<EquipmentType, string>>(
    () => ({
      fridge: t("types.fridge"),
      freezer: t("types.freezer"),
      display_case: t("types.displayCase"),
    }),
    [t],
  );

  const getRowActions = useMemo(
    () =>
      getEquipmentRowActions({
        t,
        onEdit,
        onDuplicate,
        onDelete,
      }),
    [t, onEdit, onDuplicate, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, typeLabels, getRowActions }),
    [t, typeLabels, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof EquipmentMobileCard>[0]["row"]) => (
      <EquipmentMobileCard row={row} typeLabels={typeLabels} />
    ),
    [typeLabels],
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
      emptyAction={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      enableRowSelection
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      toolbar={
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <Button type="button" variant="destructive" onClick={onBulkDelete}>
              <Trash2Icon />
              {tTable("selection.deleteSelected")}
            </Button>
          ) : null}
          <DataTableAddButton onClick={onAdd} label={t("add")} />
        </div>
      }
      onRowClick={(row) => onEdit(row.original)}
      renderMobileRow={renderMobileRow}
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.name}
    />
  );
}
