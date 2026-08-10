"use client";

import type { EquipmentResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
  CopyPlusIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { useTranslations } from "next-intl";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

type EquipmentTableRowActionsProps = {
  row: Row<EquipmentResponse>;
  t: EquipmentTranslations;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

export function EquipmentTableRowActions({
  row,
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: EquipmentTableRowActionsProps) {
  const equipment = row.original;

  return (
    <DataTableRowActions srLabel={t("openMenu")}>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(equipment)}>
              <PencilIcon />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(equipment)}>
              <CopyPlusIcon />
              {t("duplicate")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(equipment)}
            >
              <Trash2Icon />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
    </DataTableRowActions>
  );
}
