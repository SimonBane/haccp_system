"use client";

import type { TargetKind, TargetResponse } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";

type TargetsTranslations = ReturnType<typeof useTranslations<"TargetsPage">>;

type GetColumnsParams = {
  t: TargetsTranslations;
  kindLabels: Record<TargetKind, string>;
  getRowActions: GetRowActions<TargetResponse>;
};

export function getColumns({
  t,
  kindLabels,
  getRowActions,
}: GetColumnsParams): ColumnDef<TargetResponse>[] {
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
      accessorKey: "targetTypeName",
      meta: { view_label: t("columns.type") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.type")} />
      ),
      cell: ({ row }) => row.original.targetTypeName,
    },
    {
      accessorKey: "kind",
      meta: { view_label: t("columns.kind") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.kind")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {kindLabels[row.original.kind]}
        </span>
      ),
      sortingFn: (rowA, rowB) =>
        kindLabels[rowA.original.kind].localeCompare(
          kindLabels[rowB.original.kind],
        ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DataTableRowActions
          srLabel={t("openMenu")}
          actions={getRowActions(row.original)}
        />
      ),
    },
  ];
}
