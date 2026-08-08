"use client";

import type { EmployeeResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableMobileCard } from "@/components/ui/data-table/data-table-mobile-card";
import { EmployeesTableRowActions } from "@/features/employees/data-table/row-actions";
import {
  EmployeeIdentity,
  EmployeeLocationsBadges,
  EmployeeRoleBadge,
  EmployeeStatusBadge,
} from "@/features/employees/presentation";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type EmployeesMobileCardProps = {
  row: Row<EmployeeResponse>;
  t: EmployeesTranslations;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

export function EmployeesMobileCard({
  row,
  t,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
}: EmployeesMobileCardProps) {
  const employee = row.original;

  return (
    <DataTableMobileCard
      title={<EmployeeIdentity employee={employee} size="md" />}
      badges={
        <>
          <EmployeeStatusBadge employee={employee} />
          <EmployeeRoleBadge employee={employee} />
          <EmployeeLocationsBadges employee={employee} />
        </>
      }
      actions={
        <EmployeesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onInvite={onInvite}
          onRevokeInvitation={onRevokeInvitation}
          onDelete={onDelete}
        />
      }
    />
  );
}
