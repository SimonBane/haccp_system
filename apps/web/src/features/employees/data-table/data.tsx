"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { getColumns } from "@/features/employees/data-table/columns";
import { useTenant } from "@/features/tenant/tenant-provider";

type EmployeesDataProps = {
  items: EmployeeResponse[];
  onAdd: () => void;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

function EmployeesToolbar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <Button type="button" onClick={onAdd}>
      <PlusIcon />
      {label}
    </Button>
  );
}

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
    () => <EmployeesToolbar onAdd={onAdd} label={t("add")} />,
    [onAdd, t],
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
      toolbar={toolbar}
    />
  );
}
