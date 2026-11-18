import type { TargetResponse } from "@haccp/shared";
import { CopyPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type TargetsTranslations = ReturnType<typeof useTranslations<"TargetsPage">>;

type Params = {
  t: TargetsTranslations;
  onEdit: (target: TargetResponse) => void;
  onDuplicate: (target: TargetResponse) => void;
  onDelete: (target: TargetResponse) => void;
};

export function getTargetRowActions({
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: Params) {
  return (target: TargetResponse): RowAction[] => [
    {
      id: "edit",
      label: t("edit"),
      role: "primary",
      icon: createElement(PencilIcon),
      onSelect: () => onEdit(target),
    },
    {
      id: "duplicate",
      label: t("duplicate"),
      icon: createElement(CopyPlusIcon),
      onSelect: () => onDuplicate(target),
    },
    {
      id: "delete",
      label: t("delete"),
      role: "destructive",
      icon: createElement(Trash2Icon),
      onSelect: () => onDelete(target),
    },
  ];
}
