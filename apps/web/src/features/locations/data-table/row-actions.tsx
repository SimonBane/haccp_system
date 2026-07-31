"use client";

import type { LocationResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type LocationsTableRowActionsProps = {
  row: Row<LocationResponse>;
  t: LocationsTranslations;
  totalCount: number;
  onRename: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
};

export function LocationsTableRowActions({
  row,
  t,
  totalCount,
  onRename,
  onDelete,
}: LocationsTableRowActionsProps) {
  const location = row.original;
  const canDelete = !location.isDefault && totalCount > 1;
  const deleteTooltip = location.isDefault
    ? t("tooltips.cannotDeleteDefault")
    : t("tooltips.cannotDeleteLast");

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
            <DropdownMenuItem onClick={() => onRename(location)}>
              <PencilIcon />
              {t("rename")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(location)}
              >
                <Trash2Icon />
                {t("delete")}
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="block w-full">
                      <DropdownMenuItem disabled variant="destructive">
                        <Trash2Icon />
                        {t("delete")}
                      </DropdownMenuItem>
                    </span>
                  }
                />
                <TooltipContent side="left">{deleteTooltip}</TooltipContent>
              </Tooltip>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
