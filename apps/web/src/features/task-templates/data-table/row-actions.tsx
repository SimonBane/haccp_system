"use client";

import type { TaskTemplateResponse } from "@haccp/shared";
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

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type TaskTemplatesTableRowActionsProps = {
  row: Row<TaskTemplateResponse>;
  t: TasksTranslations;
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function TaskTemplatesTableRowActions({
  row,
  t,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskTemplatesTableRowActionsProps) {
  const task = row.original;

  return (
    <DataTableRowActions srLabel={t("openMenu")}>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <PencilIcon />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(task)}>
              <CopyPlusIcon />
              {t("duplicate")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
              <Trash2Icon />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
    </DataTableRowActions>
  );
}
