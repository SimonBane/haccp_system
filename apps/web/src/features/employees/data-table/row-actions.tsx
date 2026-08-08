"use client";

import type { EmployeeResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import {
  PencilIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type EmployeesTableRowActionsProps = {
  row: Row<EmployeeResponse>;
  t: EmployeesTranslations;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

export function EmployeesTableRowActions({
  row,
  t,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
}: EmployeesTableRowActionsProps) {
  const employee = row.original;

  return (
    <DataTableRowActions srLabel={t("openMenu")}>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(employee)}>
              <PencilIcon />
              {t("edit")}
            </DropdownMenuItem>
            {employee.status === "draft" ? (
              <DropdownMenuItem onClick={() => onInvite(employee)}>
                <SendIcon />
                {t("sendInvitation")}
              </DropdownMenuItem>
            ) : null}
            {employee.status === "invited" ? (
              <DropdownMenuItem onClick={() => onRevokeInvitation(employee)}>
                <Undo2Icon />
                {t("revokeInvitation")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(employee)}
            >
              <Trash2Icon />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
    </DataTableRowActions>
  );
}
