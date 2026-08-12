"use client";

import type { LocationResponse } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type GetColumnsParams = {
  t: LocationsTranslations;
  getRowActions: GetRowActions<LocationResponse>;
};

export function getColumns({
  t,
  getRowActions,
}: GetColumnsParams): ColumnDef<LocationResponse>[] {
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
      id: "default",
      accessorKey: "isDefault",
      meta: { view_label: t("columns.default") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.default")} />
      ),
      // Status only. Promoting a location moved into the row's actions, which
      // is the one place both platforms can reach — the mobile card never
      // rendered this column, so a phone could not set a default at all.
      cell: ({ row }) =>
        row.original.isDefault ? (
          <Badge variant="secondary">{t("status.default")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortingFn: (rowA, rowB) =>
        Number(rowB.original.isDefault) - Number(rowA.original.isDefault),
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
