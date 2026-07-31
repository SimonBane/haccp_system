"use client";

import type { EquipmentResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
  CopyPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
