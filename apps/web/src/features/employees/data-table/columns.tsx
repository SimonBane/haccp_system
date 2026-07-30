"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { ORG_ROLE } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { EmployeesTableRowActions } from "@/features/employees/data-table/row-actions";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type GetColumnsParams = {
  t: EmployeesTranslations;
  showLocationsColumn?: boolean;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

function displayName(employee: EmployeeResponse): string {
  const parts = [employee.firstName, employee.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : employee.email;
}

function initials(employee: EmployeeResponse): string {
  const name = displayName(employee);
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function statusVariant(
  status: EmployeeResponse["status"],
): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "invited":
      return "secondary";
    default:
      return "outline";
  }
}

export function getColumns({
  t,
  showLocationsColumn = true,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
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
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {employee.user?.hasImage ? (
                <AvatarImage
                  src={employee.user.imageUrl}
                  alt={displayName(employee)}
                />
              ) : null}
              <AvatarFallback>{initials(employee)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{displayName(employee)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {employee.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      meta: { view_label: t("columns.status") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.status")} />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {t(`status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "role",
      meta: { view_label: t("columns.role") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.role")} />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.role === ORG_ROLE.ADMIN
            ? t("roles.admin")
            : t("roles.member")}
        </Badge>
      ),
    },
    ...(showLocationsColumn
      ? [
          {
            id: "locations",
            accessorFn: (row: EmployeeResponse) =>
              row.locations.map((location) => location.name).join(", "),
            meta: { view_label: t("columns.locations") },
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t("columns.locations")}
              />
            ),
            cell: ({ row }) => {
              const locations = row.original.locations;

              if (locations.length === 0) {
                return (
                  <span className="text-sm text-muted-foreground">
                    {t("noLocations")}
                  </span>
                );
              }

              return (
                <div className="flex flex-wrap gap-1">
                  {locations.map((location) => (
                    <Badge key={location.id} variant="secondary">
                      {location.name}
                    </Badge>
                  ))}
                </div>
              );
            },
          } satisfies ColumnDef<EmployeeResponse>,
        ]
      : []),
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <EmployeesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onInvite={onInvite}
          onRevokeInvitation={onRevokeInvitation}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
