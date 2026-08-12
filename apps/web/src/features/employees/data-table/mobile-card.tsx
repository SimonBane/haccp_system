"use client";

import { ORG_ROLE, type EmployeeResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import {
  EmployeeAvatar,
  EmployeeStatusBadge,
} from "@/features/employees/presentation";
import { displayName } from "@/features/employees/utils";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type EmployeesMobileRowProps = {
  row: Row<EmployeeResponse>;
  t: EmployeesTranslations;
};

export function EmployeesMobileCard({ row, t }: EmployeesMobileRowProps) {
  const employee = row.original;
  const role =
    employee.role === ORG_ROLE.ADMIN ? t("roles.admin") : t("roles.member");

  return (
    <MobileListRow
      leading={<EmployeeAvatar employee={employee} size="md" />}
      title={displayName(employee)}
      // Email and role on one line: the two facts a manager scans for, without
      // the label/value grid that made these read like table rows on a phone.
      subtitle={`${employee.email} · ${role}`}
      trailing={<EmployeeStatusBadge employee={employee} />}
    />
  );
}
