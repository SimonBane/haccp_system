import type { EquipmentResponse } from "@haccp/shared";
import { CopyPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

type Params = {
  t: EquipmentTranslations;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

/**
 * Duplicate lives here and nowhere else now — it used to also sit in the edit
 * dialog's desktop footer, which is a strange place to decide you want a second
 * one of something you are in the middle of editing.
 */
export function getEquipmentRowActions({
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: Params) {
  return (equipment: EquipmentResponse): RowAction[] => [
    {
      id: "edit",
      label: t("edit"),
      role: "primary",
      icon: createElement(PencilIcon),
      onSelect: () => onEdit(equipment),
    },
    {
      id: "duplicate",
      label: t("duplicate"),
      icon: createElement(CopyPlusIcon),
      onSelect: () => onDuplicate(equipment),
    },
    {
      id: "delete",
      label: t("delete"),
      role: "destructive",
      icon: createElement(Trash2Icon),
      onSelect: () => onDelete(equipment),
    },
  ];
}
