"use client";

import "./types";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type Table as ReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
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
  noResultsMessage?: string;
  className?: string;
  classNameWrapper?: string;
  truncateCellValue?: boolean;
  Toolbar?: ({ table }: { table: ReactTable<TData> }) => React.ReactNode;
  enableSearch?: boolean;
  searchColumn?: string;
  searchPlaceholder?: string;
  enablePagination?: boolean;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No results.",
  noResultsMessage = "No results found.",
  className,
  classNameWrapper,
  truncateCellValue = true,
  Toolbar,
  enableSearch = false,
  searchColumn,
  searchPlaceholder,
  enablePagination = true,
  pageSize = 50,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  React.useEffect(() => {
    if (!enableSearch) {
      setColumnFilters([]);
    }
  }, [enableSearch]);

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: {
        pageSize: enablePagination ? pageSize : data.length,
      },
    },
    state: {
      ...(enablePagination
        ? {}
        : { pagination: { pageIndex: 0, pageSize: data.length } }),
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    filterFns: {
      includesString: (row, id, value) => {
        const cellValue = row.getValue(id);
        if (Array.isArray(value)) {
          return value.includes(cellValue);
        }
        return String(cellValue)
          .toLowerCase()
          .includes(String(value).toLowerCase());
      },
    },
    defaultColumn: {
      filterFn: "includesString",
    },
  });

  const visibleRows = table.getRowModel().rows;
  const isFiltered = columnFilters.length > 0;
  const displayEmptyMessage = isFiltered ? noResultsMessage : emptyMessage;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 rounded-md bg-muted/50 p-2 md:gap-2 md:p-3",
        classNameWrapper,
      )}
    >
      {enableSearch || Toolbar ? (
        <div className="shrink-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            {enableSearch && searchColumn ? (
              <DataTableSearch
                table={table}
                column={searchColumn}
                placeholder={searchPlaceholder ?? ""}
              />
            ) : null}
            {Toolbar ? <Toolbar table={table} /> : null}
          </div>
        </div>
      ) : null}

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
                      header.column.id === "select" ||
                        header.column.id === "expand" ||
                        header.column.id === "actions"
                        ? "w-10"
                        : "",
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
                  {displayEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination ? (
        <div className="shrink-0">
          <DataTablePagination table={table} />
        </div>
      ) : null}
    </div>
  );
}
