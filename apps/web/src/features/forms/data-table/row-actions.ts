import type { FormListItem } from "@haccp/shared";
import { CopyPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type FormsTranslations = ReturnType<typeof useTranslations<"FormsPage">>;

type Params = {
  t: FormsTranslations;
  onEdit: (form: FormListItem) => void;
  onDuplicate: (form: FormListItem) => void;
  onDelete: (form: FormListItem) => void;
};

export function getFormRowActions({
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: Params) {
  return (form: FormListItem): RowAction[] => [
    {
      id: "edit",
      label: t("edit"),
      role: "primary",
      icon: createElement(PencilIcon),
      onSelect: () => onEdit(form),
    },
    {
      id: "duplicate",
      label: t("duplicate"),
      icon: createElement(CopyPlusIcon),
      onSelect: () => onDuplicate(form),
    },
    {
      id: "delete",
      label: t("delete"),
      role: "destructive",
      icon: createElement(Trash2Icon),
      onSelect: () => onDelete(form),
    },
  ];
}
