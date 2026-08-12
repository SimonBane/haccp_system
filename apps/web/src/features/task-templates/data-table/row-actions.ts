import type { TaskTemplateResponse } from "@haccp/shared";
import { CopyPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type Params = {
  t: TasksTranslations;
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function getTaskTemplateRowActions({
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: Params) {
  return (task: TaskTemplateResponse): RowAction[] => [
    {
      id: "edit",
      label: t("edit"),
      role: "primary",
      icon: createElement(PencilIcon),
      onSelect: () => onEdit(task),
    },
    {
      id: "duplicate",
      label: t("duplicate"),
      icon: createElement(CopyPlusIcon),
      onSelect: () => onDuplicate(task),
    },
    {
      id: "delete",
      label: t("delete"),
      role: "destructive",
      icon: createElement(Trash2Icon),
      onSelect: () => onDelete(task),
    },
  ];
}
