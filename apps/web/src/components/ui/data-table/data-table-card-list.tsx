"use client";

import type { Row, Table as ReactTable } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  MobileList,
  type MobileListVariant,
} from "@/components/ui/data-table/data-table-mobile-list";
import { RowActionMenuItems } from "@/components/ui/data-table/data-table-row-actions";
import {
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
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils";

type DataTableCardListProps<TData> = {
  table: ReactTable<TData>;
  renderMobileRow: (row: Row<TData>) => ReactNode;
  getRowActions?: (row: Row<TData>) => RowAction[];
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
}: {
  row: Row<TData>;
  children: ReactNode;
  actions: RowAction[];
  label: string;
  onRowClick?: (row: Row<TData>) => void;
  onOpenActions: (anchor: HTMLElement) => void;
  moreActionsLabel: string;
}) {
  const hasActions = visibleRowActions(actions).length > 0;
  // One stable callback ref — an inline setter-ref re-attaches every render and tears the listeners down.
  const { ref: longPressRef, node } = useLongPress(onOpenActions, hasActions);
  const openHere = () => {
    if (node) onOpenActions(node);
  };

  return (
    <div
      ref={longPressRef}
      data-testid="data-table-card"
      className="relative"
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
          {children}
        </div>
      ) : (
        children
      )}

      {/* Focus-visible actions button: `sr-only` alone would leave a focused element nobody can see. */}
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

/** `role="button"` on a div because the row also hosts the SR actions button — nesting interactives is invalid. */
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
  // State, not a ref: the Positioner has to re-read it on the render that opens the menu.
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
            >
              {renderMobileRow(row)}
            </CardListRow>
          );
        })}
      </MobileList>

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
          className="w-max min-w-0"
        >
          <RowActionMenuItems actions={openRowActions} />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
