"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { EquipmentTableRowActions } from "@/features/equipment/data-table/row-actions";
import { formatTemp } from "@/features/equipment/lib/format";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

type GetColumnsParams = {
  t: EquipmentTranslations;
  typeLabels: Record<EquipmentType, string>;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

export function getColumns({
  t,
  typeLabels,
  onEdit,
  onDuplicate,
  onDelete,
}: GetColumnsParams): ColumnDef<EquipmentResponse>[] {
  return [
    {
      accessorKey: "name",
      enableHiding: false,
      meta: { view_label: t("columns.name") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.name")} />
      ),
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
    },
    {
      accessorKey: "type",
      meta: { view_label: t("columns.type") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.type")} />
      ),
      cell: ({ row }) => typeLabels[row.original.type],
      sortingFn: (rowA, rowB) =>
        typeLabels[rowA.original.type].localeCompare(
          typeLabels[rowB.original.type],
        ),
    },
    {
      id: "range",
      accessorFn: (row) => row.minTempC,
      meta: { view_label: t("columns.range") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.range")} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatTemp(row.original.minTempC)} –{" "}
          {formatTemp(row.original.maxTempC)}
        </span>
      ),
      sortingFn: (rowA, rowB) => {
        const a = rowA.original;
        const b = rowB.original;
        if (a.minTempC !== b.minTempC) return a.minTempC - b.minTempC;
        return a.maxTempC - b.maxTempC;
      },
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <EquipmentTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
