"use client";

import { MoreHorizontalIcon } from "lucide-react";
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
  visibleRowActions,
  type RowAction,
} from "@/components/ui/data-table/row-action";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ActionItem({ action }: { action: RowAction }) {
  const item = (
    <DropdownMenuItem
      disabled={action.disabled}
      variant={action.role === "destructive" ? "destructive" : undefined}
      onClick={action.onSelect}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  );

  // Disabled items swallow pointer events, so the tooltip hangs off a wrapper.
  if (!action.disabled || !action.disabledReason) return item;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block w-full">{item}</span>} />
      <TooltipContent side="left">{action.disabledReason}</TooltipContent>
    </Tooltip>
  );
}

export function RowActionMenuItems({ actions }: { actions: RowAction[] }) {
  const items = visibleRowActions(actions);
  const primary = items.filter((action) => action.role !== "destructive");
  const destructive = items.filter((action) => action.role === "destructive");

  return (
    <>
      {primary.length ? (
        <DropdownMenuGroup>
          {primary.map((action) => (
            <ActionItem key={action.id} action={action} />
          ))}
        </DropdownMenuGroup>
      ) : null}

      {primary.length && destructive.length ? <DropdownMenuSeparator /> : null}

      {destructive.length ? (
        <DropdownMenuGroup>
          {destructive.map((action) => (
            <ActionItem key={action.id} action={action} />
          ))}
        </DropdownMenuGroup>
      ) : null}
    </>
  );
}

export function DataTableRowActions({
  srLabel,
  actions,
}: {
  srLabel: string;
  actions: RowAction[];
}) {
  if (!visibleRowActions(actions).length) return null;

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
          <RowActionMenuItems actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
