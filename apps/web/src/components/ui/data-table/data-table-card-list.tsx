"use client";

import type { Row, Table as ReactTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type DataTableCardListProps<TData> = {
  table: ReactTable<TData>;
  renderMobileCard: (row: Row<TData>) => ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  emptyMessage: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  className?: string;
};

export function DataTableCardList<TData>({
  table,
  renderMobileCard,
  onRowClick,
  emptyMessage,
  emptyDescription,
  emptyAction,
  className,
}: DataTableCardListProps<TData>) {
  const rows = table.getRowModel().rows;

  if (!rows.length) {
    return (
      <div
        className={cn(
          "rounded-md border bg-card",
          className,
        )}
      >
        <Empty className="border-none py-10">
          <EmptyHeader>
            <EmptyTitle className="text-base">{emptyMessage}</EmptyTitle>
            {emptyDescription ? (
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            ) : null}
          </EmptyHeader>
          {emptyAction ? (
            <EmptyContent>{emptyAction}</EmptyContent>
          ) : null}
        </Empty>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((row) => {
        const isRowClickable = Boolean(onRowClick);

        return (
          <div
            key={row.id}
            className={cn(isRowClickable && "cursor-pointer")}
            role={isRowClickable ? "button" : undefined}
            tabIndex={isRowClickable ? 0 : undefined}
            onKeyDown={(event) => {
              if (!onRowClick) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRowClick(row);
              }
            }}
            onClick={(event) => {
              if (!onRowClick) return;
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
            {renderMobileCard(row)}
          </div>
        );
      })}
    </div>
  );
}
