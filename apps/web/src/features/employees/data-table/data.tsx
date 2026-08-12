"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/employees/data-table/columns";
import { EmployeesMobileCard } from "@/features/employees/data-table/mobile-card";
import { getEmployeeRowActions } from "@/features/employees/data-table/row-actions";
import { useTenant } from "@/features/tenant/tenant-provider";
import { displayName } from "@/features/employees/utils";
import { primeKeyboard } from "@/lib/keyboard-primer";

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

  // Priming has to happen inside the tap; see lib/keyboard-primer.
  const openAdd = useCallback(() => {
    primeKeyboard();
    onAdd();
  }, [onAdd]);

  const openEdit = useCallback(
    (employee: EmployeeResponse) => {
      // An active member's email field is disabled, so there is nothing for a
      // primed keyboard to land in.
      if (employee.status !== "active") primeKeyboard();
      onEdit(employee);
    },
    [onEdit],
  );

  const getRowActions = useMemo(
    () =>
      getEmployeeRowActions({
        t,
        onEdit: openEdit,
        onInvite,
        onRevokeInvitation,
        onDelete,
      }),
    [t, openEdit, onInvite, onRevokeInvitation, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, showLocationsColumn, getRowActions }),
    [t, showLocationsColumn, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof EmployeesMobileCard>[0]["row"]) => (
      <EmployeesMobileCard row={row} t={t} />
    ),
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="employee"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyAction={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      toolbar={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      onRowClick={(row) => openEdit(row.original)}
      renderMobileRow={renderMobileRow}
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => displayName(row.original)}
    />
  );
}
