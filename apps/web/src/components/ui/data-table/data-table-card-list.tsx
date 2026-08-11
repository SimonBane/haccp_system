"use client";

import type { Row, Table as ReactTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { MobileList } from "@/components/ui/data-table/data-table-mobile-list";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { cn } from "@/lib/utils";

type DataTableCardListProps<TData> = {
  table: ReactTable<TData>;
  renderMobileRow: (row: Row<TData>) => ReactNode;
  /** Optional swipe-left tray. The row's overflow menu stays the a11y path. */
  renderSwipeActions?: (row: Row<TData>) => ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  emptyMessage: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  className?: string;
};

/**
 * The mobile face of a data table: one grouped list instead of a grid.
 *
 * Rows carry `role="button"` on a div rather than being real buttons, because
 * each row also contains its own overflow menu and nesting interactive
 * elements is invalid. Keyboard activation is wired by hand to compensate.
 */
export function DataTableCardList<TData>({
  table,
  renderMobileRow,
  renderSwipeActions,
  onRowClick,
  emptyMessage,
  emptyDescription,
  emptyAction,
  className,
}: DataTableCardListProps<TData>) {
  const rows = table.getRowModel().rows;

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

  return (
    <MobileList className={className}>
      {rows.map((row) => {
        const swipeActions = renderSwipeActions?.(row);
        const inner = renderMobileRow(row);
        const content = swipeActions ? (
          <SwipeableRow actions={swipeActions}>{inner}</SwipeableRow>
        ) : (
          inner
        );

        if (!onRowClick) {
          return <div key={row.id}>{content}</div>;
        }

        return (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onRowClick(row);
            }}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest("button") ||
                target.closest('[data-slot="dropdown-menu"]')
              ) {
                return;
              }
              onRowClick(row);
            }}
          >
            {content}
          </div>
        );
      })}
    </MobileList>
  );
}
