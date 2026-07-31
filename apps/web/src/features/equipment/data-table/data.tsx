"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { getColumns } from "@/features/equipment/data-table/columns";
import { EquipmentMobileCard } from "@/features/equipment/data-table/mobile-card";

type EquipmentDataProps = {
  items: EquipmentResponse[];
  onAdd: () => void;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

function EquipmentToolbar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <Button type="button" onClick={onAdd}>
      <PlusIcon />
      {label}
    </Button>
  );
}

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

  const toolbar = useMemo<ReactNode>(
    () => <EquipmentToolbar onAdd={onAdd} label={t("add")} />,
    [onAdd, t],
  );

  const renderMobileCard = useCallback(
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
        <Button type="button" onClick={onAdd}>
          <PlusIcon />
          {t("add")}
        </Button>
      }
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onEdit(row.original)}
      renderMobileCard={renderMobileCard}
      toolbar={toolbar}
    />
  );
}
