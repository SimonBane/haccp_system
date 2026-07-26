"use client";

import type { TaskTemplateResponse } from "@haccp/shared";
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
    <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 p-0"
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
