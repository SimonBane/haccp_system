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

  // A disabled item swallows pointer events, so the tooltip has to hang off a
  // wrapper — otherwise "why is delete greyed out" has no answer on desktop.
  if (!action.disabled || !action.disabledReason) return item;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block w-full">{item}</span>} />
      <TooltipContent side="left">{action.disabledReason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The menu body: primary actions, a rule, then the destructive one.
 *
 * Shared so the desktop kebab and the mobile long-press menu are the same list
 * in the same order — the point of the whole `RowAction[]` shape.
 */
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

/**
 * A row's overflow menu on the desktop grid, rendered from the same
 * `RowAction[]` the mobile long-press menu uses.
 *
 * It used to be a bare shell each feature filled with its own menu items, which
 * is how four near-identical row-action components came to exist. The
 * differences between them — a status gate, a tooltip on a disabled delete —
 * are all expressible as data, so they are.
 */
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
          <RowActionMenuItems actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
