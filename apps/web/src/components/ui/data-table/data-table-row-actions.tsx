"use client";

import { MoreHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The chrome around a row's action menu: trigger sizing, the accessible label,
 * and the three stopPropagation handlers that keep a menu tap from also
 * activating the row behind it.
 *
 * Only the shell is shared — each feature's menu items differ enough (status
 * gates, a tooltip-wrapped disabled delete, a duplicate action) that a generic
 * item list would take more props than it saves. This is the part that was
 * character-identical across all four.
 */
export function DataTableRowActions({
  srLabel,
  children,
}: {
  srLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              // 40px on touch, 32px from md up: a wet-gloved tap target on a
              // tablet, a conventional icon button on a desktop table.
              className="h-10 w-10 p-0 md:h-8 md:w-8"
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <span className="sr-only">{srLabel}</span>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-max min-w-0"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
