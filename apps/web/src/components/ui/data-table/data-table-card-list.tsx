"use client";

import type { Row, Table as ReactTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DataTableCardListProps<TData> = {
  table: ReactTable<TData>;
  renderMobileCard: (row: Row<TData>) => ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  emptyMessage: string;
  className?: string;
};

export function DataTableCardList<TData>({
  table,
  renderMobileCard,
  onRowClick,
  emptyMessage,
  className,
}: DataTableCardListProps<TData>) {
  const rows = table.getRowModel().rows;

  if (!rows.length) {
    return (
      <div
        className={cn(
          "flex h-24 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
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
