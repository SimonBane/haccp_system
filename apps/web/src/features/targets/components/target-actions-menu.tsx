"use client";

import type { TargetResponse } from "@haccp/shared";
import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TargetActions = {
  onEdit: (target: TargetResponse) => void;
  onDuplicate: (target: TargetResponse) => void;
  onDelete: (target: TargetResponse) => void;
};

export function TargetActionsMenu({
  target,
  actions,
}: {
  target: TargetResponse;
  actions: TargetActions;
}) {
  const t = useTranslations("TargetsPage");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label={t("openMenu", { name: target.name })}
          >
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => actions.onEdit(target)}>
          <PencilIcon />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.onDuplicate(target)}>
          <CopyIcon />
          {t("duplicate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => actions.onDelete(target)}
        >
          <Trash2Icon />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
