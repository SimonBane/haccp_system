import type { EmployeeResponse } from "@haccp/shared";
import { PencilIcon, SendIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type Params = {
  t: EmployeesTranslations;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

export function getEmployeeRowActions({
  t,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
}: Params) {
  return (employee: EmployeeResponse): RowAction[] => [
    {
      id: "edit",
      label: t("edit"),
      role: "primary",
      icon: createElement(PencilIcon),
      onSelect: () => onEdit(employee),
    },
    {
      id: "invite",
      label: t("sendInvitation"),
      icon: createElement(SendIcon),
      hidden: employee.status !== "draft",
      onSelect: () => onInvite(employee),
    },
    {
      id: "revoke",
      label: t("revokeInvitation"),
      icon: createElement(Undo2Icon),
      hidden: employee.status !== "invited",
      onSelect: () => onRevokeInvitation(employee),
    },
    {
      id: "delete",
      label: t("delete"),
      role: "destructive",
      icon: createElement(Trash2Icon),
      onSelect: () => onDelete(employee),
    },
  ];
}
