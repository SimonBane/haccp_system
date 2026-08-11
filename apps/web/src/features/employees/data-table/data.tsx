"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { MobileListSwipeAction } from "@/components/ui/data-table/data-table-mobile-list";
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

  const renderSwipeActions = useCallback(
    (row: { original: EmployeeResponse }) => (
      <>
        <MobileListSwipeAction
          label={t("edit")}
          icon={<PencilIcon className="size-4" />}
          onClick={() => onEdit(row.original)}
        />
        <MobileListSwipeAction
          label={t("delete")}
          icon={<Trash2Icon className="size-4" />}
          variant="destructive"
          onClick={() => onDelete(row.original)}
        />
      </>
    ),
    [onDelete, onEdit, t],
  );

  const renderMobileRow = useCallback(
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
      emptyAction={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      toolbar={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      onRowClick={(row) => onEdit(row.original)}
      renderMobileRow={renderMobileRow}
      renderSwipeActions={renderSwipeActions}
    />
  );
}
