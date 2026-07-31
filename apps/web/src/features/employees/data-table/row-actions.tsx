"use client";

import type { EmployeeResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import {
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-10 p-0 md:h-8 md:w-8"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <span className="sr-only">{t("openMenu")}</span>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-max min-w-0"
          onClick={(event) => event.stopPropagation()}
        >
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
