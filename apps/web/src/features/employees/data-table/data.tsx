"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/employees/data-table/columns";
import { EmployeesMobileCard } from "@/features/employees/data-table/mobile-card";
import { useTenant } from "@/features/tenant/tenant-provider";

type EmployeesDataProps = {
  items: EmployeeResponse[];
  onAdd: () => void;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

export function EmployeesData({
  items,
  onAdd,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
}: EmployeesDataProps) {
  const t = useTranslations("EmployeesPage");
  const tTable = useTranslations("DataTable");
  const { organization } = useTenant();
  const showLocationsColumn = organization.multipleLocationsEnabled;

  const columns = useMemo(
    () =>
      getColumns({
        t,
        showLocationsColumn,
        onEdit,
        onInvite,
        onRevokeInvitation,
        onDelete,
      }),
    [t, showLocationsColumn, onEdit, onInvite, onRevokeInvitation, onDelete],
  );

  const toolbar = useMemo<ReactNode>(
    () => <DataTableAddButton onClick={onAdd} label={t("add")} />,
    [onAdd, t],
  );

  const renderMobileCard = useCallback(
    (row: Parameters<typeof EmployeesMobileCard>[0]["row"]) => (
      <EmployeesMobileCard
        row={row}
        t={t}
        onEdit={onEdit}
        onInvite={onInvite}
        onRevokeInvitation={onRevokeInvitation}
        onDelete={onDelete}
      />
    ),
    [t, onEdit, onInvite, onRevokeInvitation, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="employee"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onEdit(row.original)}
      renderMobileCard={renderMobileCard}
      toolbar={toolbar}
    />
  );
}
