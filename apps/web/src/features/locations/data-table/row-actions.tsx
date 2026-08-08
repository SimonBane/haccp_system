"use client";

import type { LocationResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
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
    <DataTableRowActions srLabel={t("openMenu")}>
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
    </DataTableRowActions>
  );
}
