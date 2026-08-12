"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { requiresLocationAssignments } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";
import {
  EmployeeIdentity,
  EmployeeLocationsBadges,
  EmployeeRoleBadge,
  EmployeeStatusBadge,
} from "@/features/employees/presentation";
import { displayName } from "@/features/employees/utils";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type GetColumnsParams = {
  // Column definitions are built outside React, so this one genuinely has to be
  // passed in — the cells below render inside it and use the shared components.
  t: EmployeesTranslations;
  showLocationsColumn?: boolean;
  getRowActions: GetRowActions<EmployeeResponse>;
};

export function getColumns({
  t,
  showLocationsColumn = true,
  getRowActions,
}: GetColumnsParams): ColumnDef<EmployeeResponse>[] {
  return [
    {
      id: "employee",
      accessorFn: (row) => displayName(row),
      enableHiding: false,
      meta: { view_label: t("columns.employee") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.employee")} />
      ),
      cell: ({ row }) => <EmployeeIdentity employee={row.original} />,
    },
    {
      accessorKey: "status",
      meta: { view_label: t("columns.status") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.status")} />
      ),
      cell: ({ row }) => <EmployeeStatusBadge employee={row.original} />,
    },
    {
      accessorKey: "role",
      meta: { view_label: t("columns.role") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.role")} />
      ),
      cell: ({ row }) => <EmployeeRoleBadge employee={row.original} />,
    },
    ...(showLocationsColumn
      ? [
          {
            id: "locations",
            accessorFn: (row: EmployeeResponse) =>
              requiresLocationAssignments(row.role)
                ? row.locations.map((location) => location.name).join(", ")
                : t("allLocations"),
            meta: { view_label: t("columns.locations") },
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t("columns.locations")}
              />
            ),
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-1">
                <EmployeeLocationsBadges employee={row.original} />
              </div>
            ),
          } satisfies ColumnDef<EmployeeResponse>,
        ]
      : []),
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
