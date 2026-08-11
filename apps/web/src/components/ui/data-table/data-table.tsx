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
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as ReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import * as React from "react";
import { DataTableCardList } from "@/components/ui/data-table/data-table-card-list";
import { DataTableColumnHideButton } from "@/components/ui/data-table/data-table-column-hide-button";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { createSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: Row<TData>) => void;
  renderMobileRow?: (row: Row<TData>) => React.ReactNode;
  /** Swipe-left tray on the mobile list. The row menu remains the a11y path. */
  renderSwipeActions?: (row: Row<TData>) => React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  noResultsMessage?: string;
  className?: string;
  classNameWrapper?: string;
  truncateCellValue?: boolean;
  Toolbar?: ({ table }: { table: ReactTable<TData> }) => React.ReactNode;
  toolbar?: React.ReactNode;
  enableSearch?: boolean;
  searchColumn?: string;
  searchPlaceholder?: string;
  enablePagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  showSelectionCount?: boolean;
  getRowId?: (originalRow: TData, index: number) => string;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  initialSorting?: SortingState;
}

const TABLE_FILTER_FNS = {
  includesString: (
    row: { getValue: (id: string) => unknown },
    id: string,
    value: unknown,
  ) => {
    const cellValue = row.getValue(id);
    if (Array.isArray(value)) {
      return value.includes(cellValue);
    }
    return String(cellValue)
      .toLowerCase()
      .includes(String(value).toLowerCase());
  },
};

const TABLE_DEFAULT_COLUMN = {
  filterFn: "includesString" as const,
};

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  renderMobileRow,
  renderSwipeActions,
  emptyMessage = "No results.",
  emptyDescription,
  emptyAction,
  noResultsMessage = "No results found.",
  className,
  classNameWrapper,
  truncateCellValue = true,
  Toolbar,
  toolbar,
  enableSearch = false,
  searchColumn,
  searchPlaceholder,
  enablePagination = true,
  pageSize = 50,
  pageSizeOptions,
  enableColumnVisibility = false,
  enableRowSelection = false,
  showSelectionCount,
  getRowId,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  rowSelection: rowSelectionProp,
  onRowSelectionChange,
  initialSorting,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("DataTable.selection");
  const isMobile = useIsMobile();
  const useCardList = isMobile && Boolean(renderMobileRow);
  const [sorting, setSorting] = React.useState<SortingState>(
    initialSorting ?? [],
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({});

  const columnVisibility = columnVisibilityProp ?? internalColumnVisibility;
  const setColumnVisibility =
    onColumnVisibilityChange ?? setInternalColumnVisibility;
  const rowSelection = rowSelectionProp ?? internalRowSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalRowSelection;

  const hasSelectColumn = columns.some((column) => column.id === "select");
  const tableColumns = React.useMemo(() => {
    if (!enableRowSelection || hasSelectColumn) {
      return columns;
    }

    return [
      createSelectColumn<TData>({
        selectAll: t("selectAll"),
        selectRow: t("selectRow"),
      }),
      ...columns,
    ];
  }, [columns, enableRowSelection, hasSelectColumn, t]);

  React.useEffect(() => {
    if (!enableSearch) {
      setColumnFilters([]);
    }
  }, [enableSearch]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
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
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    filterFns: TABLE_FILTER_FNS,
    defaultColumn: TABLE_DEFAULT_COLUMN,
  });

  const visibleRows = table.getRowModel().rows;
  const isFiltered = columnFilters.length > 0;
  const displayEmptyMessage = isFiltered ? noResultsMessage : emptyMessage;
  const showColumnVisibility = enableColumnVisibility && !useCardList;
  const showInlineToolbar = Boolean(Toolbar) || Boolean(toolbar);
  const showToolbar =
    enableSearch ||
    (showInlineToolbar && !useCardList) ||
    showColumnVisibility;
  const shouldShowSelectionCount = showSelectionCount ?? enableRowSelection;

  return (
    <div
      className={cn(
        // No frame around the toolbar and grid. The table already draws its
        // own card; a tinted, ringed box around that plus the search field
        // was a second container doing no work.
        "flex min-h-0 flex-1 flex-col gap-3",
        classNameWrapper,
      )}
    >
      {showToolbar ? (
        <div className="shrink-0">
          <div
            className={cn(
              "flex flex-col gap-2",
              !useCardList && "sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
            )}
          >
            <div
              className={cn(
                "flex w-full flex-col gap-2",
                !useCardList && "sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
              )}
            >
              {enableSearch && searchColumn ? (
                <DataTableSearch
                  table={table}
                  column={searchColumn}
                  placeholder={searchPlaceholder ?? ""}
                />
              ) : null}
              {showColumnVisibility ? (
                <DataTableViewOptions table={table} />
              ) : null}
            </div>
            {Toolbar ? (
              <Toolbar table={table} />
            ) : toolbar && !useCardList ? (
              <div>{toolbar}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {useCardList && renderMobileRow ? (
        <DataTableCardList
          table={table}
          renderMobileRow={renderMobileRow}
          renderSwipeActions={renderSwipeActions}
          onRowClick={onRowClick}
          emptyMessage={displayEmptyMessage}
          emptyDescription={isFiltered ? undefined : emptyDescription}
          emptyAction={isFiltered || useCardList ? undefined : emptyAction}
          className={className}
        />
      ) : (
      <div
        className={cn(
          "min-h-0 overflow-auto rounded-md border bg-card shadow-xs",
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
                      <div className="inline-flex w-fit max-w-full items-center gap-0.5">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {showColumnVisibility ? (
                          <DataTableColumnHideButton column={header.column} />
                        ) : null}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length ? (
              visibleRows.map((row) => {
                const isRowClickable = Boolean(onRowClick);

                return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "group h-8 md:h-auto",
                    isRowClickable && "cursor-pointer",
                  )}
                  tabIndex={isRowClickable ? 0 : undefined}
                  role={isRowClickable ? "button" : undefined}
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
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        truncateCellValue
                          ? "max-w-[300px] truncate"
                          : "whitespace-pre-wrap",
                        cell.column.columnDef.meta?.sticky && "left-0 z-20",
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.hidden && "hidden",
                      )}
                      title={
                        typeof cell.getContext().getValue() === "string"
                          ? (cell.getContext().getValue() as string)
                          : ""
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center"
                >
                  {displayEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* No pager on the mobile list: native lists scroll, and these sets are
          tens of rows. Search still narrows them. */}
      {enablePagination && !useCardList ? (
        <div className="shrink-0">
          <DataTablePagination
            table={table}
            pageSizeOptions={pageSizeOptions}
            showSelectionCount={shouldShowSelectionCount}
          />
        </div>
      ) : null}
    </div>
  );
}
