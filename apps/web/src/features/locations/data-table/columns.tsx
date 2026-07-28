"use client";

import type { LocationResponse } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { LocationsTableRowActions } from "@/features/locations/data-table/row-actions";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type GetColumnsParams = {
  t: LocationsTranslations;
  totalCount: number;
  settingDefaultId: string | null;
  onRename: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
  onSetDefault: (location: LocationResponse) => void;
};

export function getColumns({
  t,
  totalCount,
  settingDefaultId,
  onRename,
  onDelete,
  onSetDefault,
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
      cell: ({ row }) => {
        const location = row.original;
        const isSettingDefault = settingDefaultId === location.id;

        if (location.isDefault) {
          return <Badge variant="secondary">{t("status.default")}</Badge>;
        }

        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={isSettingDefault}
            onClick={(event) => {
              event.stopPropagation();
              onSetDefault(location);
            }}
          >
            {isSettingDefault ? (
              <Loader2Icon className="animate-spin" />
            ) : null}
            {t("setAsDefault")}
          </Button>
        );
      },
      sortingFn: (rowA, rowB) =>
        Number(rowB.original.isDefault) - Number(rowA.original.isDefault),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <LocationsTableRowActions
          row={row}
          t={t}
          totalCount={totalCount}
          onRename={onRename}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
