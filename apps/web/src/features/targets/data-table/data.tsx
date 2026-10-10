"use client";

import type { TargetKind, TargetResponse } from "@haccp/shared";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { Settings2Icon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/targets/data-table/columns";
import { TargetsMobileCard } from "@/features/targets/data-table/mobile-card";
import { getTargetRowActions } from "@/features/targets/data-table/row-actions";

// Stable sort over the API's name order, so rows read grouped by type.
const TYPE_SORTING = [{ id: "targetTypeName", desc: false }];

type TargetsDataProps = {
  items: TargetResponse[];
  kindLabels: Record<TargetKind, string>;
  onAdd: () => void;
  onManageTypes: () => void;
  onEdit: (target: TargetResponse) => void;
  onDuplicate: (target: TargetResponse) => void;
  onDelete: (target: TargetResponse) => void;
  onBulkDelete: () => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

export function TargetsData({
  items,
  kindLabels,
  onAdd,
  onManageTypes,
  onEdit,
  onDuplicate,
  onDelete,
  onBulkDelete,
  rowSelection,
  onRowSelectionChange,
}: TargetsDataProps) {
  const t = useTranslations("TargetsPage");
  const tTable = useTranslations("DataTable");
  const selectedCount = useMemo(
    () => Object.values(rowSelection).filter(Boolean).length,
    [rowSelection],
  );

  const getRowActions = useMemo(
    () => getTargetRowActions({ t, onEdit, onDuplicate, onDelete }),
    [t, onEdit, onDuplicate, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, kindLabels, getRowActions }),
    [t, kindLabels, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof TargetsMobileCard>[0]["row"]) => (
      <TargetsMobileCard row={row} kindLabels={kindLabels} />
    ),
    [kindLabels],
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
      initialSorting={TYPE_SORTING}
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
          <Button type="button" variant="outline" onClick={onManageTypes}>
            <Settings2Icon />
            {t("manageTypes")}
          </Button>
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
