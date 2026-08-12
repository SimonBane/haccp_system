"use client";

import type { Row, Table as ReactTable } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  MobileList,
  MobileListSwipeAction,
  type MobileListVariant,
} from "@/components/ui/data-table/data-table-mobile-list";
import { RowActionMenuItems } from "@/components/ui/data-table/data-table-row-actions";
import {
  destructiveRowAction,
  visibleRowActions,
  type RowAction,
} from "@/components/ui/data-table/row-action";
import { DropdownMenu, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils";

type DataTableCardListProps<TData> = {
  table: ReactTable<TData>;
  renderMobileRow: (row: Row<TData>) => ReactNode;
  /** Everything you can do to a row. See `row-action.ts`. */
  getRowActions?: (row: Row<TData>) => RowAction[];
  /** Names the row in the screen-reader actions button. */
  getRowLabel?: (row: Row<TData>) => string;
  onRowClick?: (row: Row<TData>) => void;
  variant?: MobileListVariant;
  emptyMessage: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  className?: string;
};

function CardListRow<TData>({
  row,
  children,
  actions,
  label,
  onRowClick,
  onOpenActions,
  moreActionsLabel,
  variant,
}: {
  row: Row<TData>;
  children: ReactNode;
  actions: RowAction[];
  label: string;
  onRowClick?: (row: Row<TData>) => void;
  /** Passes the row element up, so the menu can anchor to what was pressed. */
  onOpenActions: (anchor: HTMLElement) => void;
  moreActionsLabel: string;
  variant: MobileListVariant;
}) {
  const hasActions = visibleRowActions(actions).length > 0;
  // The hook owns the ref and hands the node back, so the row keeps a single
  // stable callback ref rather than an inline one that re-attaches every render
  // — which, with a `useState` setter ref, detaches to null and back on each
  // pass and rebuilds the listeners continuously.
  const { ref: longPressRef, node } = useLongPress(onOpenActions, hasActions);
  const openHere = () => {
    if (node) onOpenActions(node);
  };
  const deleteAction = destructiveRowAction(actions);

  const content = deleteAction ? (
    // One action, so a narrower tray than the two-action one this replaces.
    // No swipe-past-threshold auto-commit: deletes here are permanent, there is
    // no trash to recover from, and the confirm dialog stays.
    <SwipeableRow
      actionsWidth={88}
      // Matches the card's own corners, or the tray revealed behind it shows
      // square red corners poking past a rounded card.
      className={variant === "card" ? "rounded-xl" : undefined}
      actions={
        <MobileListSwipeAction
          label={deleteAction.label}
          icon={deleteAction.icon ?? <Trash2Icon className="size-4" />}
          variant="destructive"
          onClick={deleteAction.onSelect}
        />
      }
    >
      {children}
    </SwipeableRow>
  ) : (
    children
  );

  return (
    <div
      ref={longPressRef}
      className="relative"
      // Right-click is the desktop equivalent of press-and-hold; the mobile
      // list can render at a narrow desktop viewport too.
      onContextMenu={(event) => {
        if (!hasActions) return;
        event.preventDefault();
        openHere();
      }}
    >
      {onRowClick ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={label}
          className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onKeyDown={(event) => {
            // Shift+F10 and the ContextMenu key are the platform's "show me
            // this item's actions" — the keyboard path that replaces the kebab.
            if (
              hasActions &&
              (event.key === "ContextMenu" ||
                (event.key === "F10" && event.shiftKey))
            ) {
              event.preventDefault();
              openHere();
              return;
            }
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onRowClick(row);
          }}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("button")) return;
            onRowClick(row);
          }}
        >
          {content}
        </div>
      ) : (
        content
      )}

      {/*
        The keyboard and switch-control path to the actions, since the row
        carries no visible control any more. Invisible until focused, then a
        real button — `sr-only` alone would leave a focused element nobody can
        see. The row's own click handler bails on `closest("button")`, so this
        never double-fires.
      */}
      {hasActions ? (
        <button
          type="button"
          aria-label={moreActionsLabel}
          onClick={openHere}
          className="sr-only focus:not-sr-only focus:absolute focus:end-2 focus:top-1/2 focus:z-10 focus:inline-flex focus:size-10 focus:-translate-y-1/2 focus:items-center focus:justify-center focus:rounded-md focus:bg-popover focus:text-sm focus:ring-2 focus:ring-ring"
        >
          ⋯
        </button>
      ) : null}
    </div>
  );
}

/**
 * The mobile face of a data table: one grouped list instead of a grid.
 *
 * Three gestures, the same on every page: tap runs the row's primary action,
 * press-and-hold opens all of them in a menu anchored on the row itself, and
 * swipe-left reveals delete. That replaced a kebab button, a decorative chevron
 * and a two-action swipe tray competing for the same 40px of row.
 *
 * The menu is the same component the desktop kebab opens — the press just
 * anchors it to the row instead of to a trigger button, so what you get is the
 * row's menu appearing on the row, not a separate mobile surface.
 *
 * Rows carry `role="button"` on a div rather than being real buttons, because a
 * row also hosts the screen-reader actions button and nesting interactive
 * elements is invalid. Keyboard activation is wired by hand to compensate.
 */
export function DataTableCardList<TData>({
  table,
  renderMobileRow,
  getRowActions,
  getRowLabel,
  onRowClick,
  variant = "row",
  emptyMessage,
  emptyDescription,
  emptyAction,
  className,
}: DataTableCardListProps<TData>) {
  const t = useTranslations("DataTable.rowActions");
  const rows = table.getRowModel().rows;
  const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);
  // Held in state, not a ref: the Positioner has to re-read it on the render
  // that opens the menu, and a ref write would not schedule one.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!rows.length) {
    return (
      <div className={cn("rounded-xl bg-card ring-1 ring-border", className)}>
        <Empty className="border-none py-10">
          <EmptyHeader>
            <EmptyTitle className="text-base">{emptyMessage}</EmptyTitle>
            {emptyDescription ? (
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            ) : null}
          </EmptyHeader>
          {emptyAction ? <EmptyContent>{emptyAction}</EmptyContent> : null}
        </Empty>
      </div>
    );
  }

  const openRow = rows.find((row) => row.id === openActionsRowId) ?? null;
  const openRowActions = openRow ? (getRowActions?.(openRow) ?? []) : [];

  return (
    <>
      <MobileList variant={variant} className={className}>
        {rows.map((row) => {
          const label = getRowLabel?.(row) ?? "";

          return (
            <CardListRow
              key={row.id}
              row={row}
              actions={getRowActions?.(row) ?? []}
              label={label}
              onRowClick={onRowClick}
              onOpenActions={(node) => {
                setAnchor(node);
                setOpenActionsRowId(row.id);
              }}
              moreActionsLabel={t("more", { name: label })}
              variant={variant}
            >
              {renderMobileRow(row)}
            </CardListRow>
          );
        })}
      </MobileList>

      {/* One menu for the whole list, anchored to whichever row was pressed —
          one per row would mean a portal per record. */}
      <DropdownMenu
        open={openRow !== null}
        onOpenChange={(next) => {
          if (!next) setOpenActionsRowId(null);
        }}
      >
        <DropdownMenuContent
          anchor={anchor}
          align="center"
          side="bottom"
          sideOffset={-8}
          // Sized by its longest label. min-w-0 is needed to beat the popup's
          // own min-w-32, which is a floor meant for trigger-anchored menus.
          className="w-max min-w-0"
        >
          <RowActionMenuItems actions={openRowActions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
