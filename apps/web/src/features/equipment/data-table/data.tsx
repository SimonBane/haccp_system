"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/equipment/data-table/columns";
import { EquipmentMobileCard } from "@/features/equipment/data-table/mobile-card";
import { getEquipmentRowActions } from "@/features/equipment/data-table/row-actions";
import { primeKeyboard } from "@/lib/keyboard-primer";

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

  // The form's first field wants the keyboard up, and iOS only grants that
  // inside the tap itself — so it has to be primed here, not in the form.
  const openAdd = useCallback(() => {
    primeKeyboard();
    onAdd();
  }, [onAdd]);

  const openEdit = useCallback(
    (equipment: EquipmentResponse) => {
      primeKeyboard();
      onEdit(equipment);
    },
    [onEdit],
  );

  const getRowActions = useMemo(
    () =>
      getEquipmentRowActions({
        t,
        onEdit: openEdit,
        onDuplicate,
        onDelete,
      }),
    [t, openEdit, onDuplicate, onDelete],
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
      emptyAction={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      toolbar={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      onRowClick={(row) => openEdit(row.original)}
      renderMobileRow={renderMobileRow}
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.name}
    />
  );
}
