"use client";

import "./types";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: Row<TData>) => void;
  emptyMessage?: string;
  className?: string;
  classNameWrapper?: string;
  truncateCellValue?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No results.",
  className,
  classNameWrapper,
  truncateCellValue = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleRows = table.getRowModel().rows;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 rounded-md bg-muted/50 p-2 md:gap-2 md:p-3",
        classNameWrapper,
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-auto rounded-md border bg-card px-1 pb-1 shadow-xs md:px-0 md:pb-2",
          className,
        )}
      >
        <Table className="[&_[data-slot=table-head]]:min-h-7 [&_[data-slot=table-head]]:px-1.5 [&_[data-slot=table-head]]:pt-1 [&_[data-slot=table-head]]:pb-1 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-cell]]:px-1.5 [&_[data-slot=table-cell]]:py-0.5 [&_[data-slot=table-cell]]:text-xs md:[&_[data-slot=table-head]]:min-h-10 md:[&_[data-slot=table-head]]:px-6 md:[&_[data-slot=table-head]]:pt-2 md:[&_[data-slot=table-head]]:pb-2 md:[&_[data-slot=table-head]]:text-sm md:[&_[data-slot=table-cell]]:px-6 md:[&_[data-slot=table-cell]]:py-2 md:[&_[data-slot=table-cell]]:text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.id === "select" || header.column.id === "expand" || header.column.id === "actions" ? "w-10" : "",
                      header.column.columnDef.meta?.className,
                      "group sticky top-0 z-40 bg-card",
                      header.column.columnDef.meta?.sticky && "left-0 z-50",
                      header.column.columnDef.meta?.hidden && "hidden",
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </div>
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="group h-8 md:h-auto"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        truncateCellValue
                          ? "max-w-[300px] truncate"
                          : "whitespace-pre-wrap",
                        cell.column.columnDef.meta?.sticky && "left-0 z-20",
                        cell.column.columnDef.meta?.className,
                        onRowClick && "cursor-pointer",
                        cell.column.columnDef.meta?.hidden && "hidden",
                      )}
                      title={
                        typeof cell.getContext().getValue() === "string"
                          ? (cell.getContext().getValue() as string)
                          : ""
                      }
                      onClick={() => onRowClick?.(row)}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
