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
import type { MobileListVariant } from "@/components/ui/data-table/data-table-mobile-list";
import type { RowAction } from "@/components/ui/data-table/row-action";
import { DataTableColumnHideButton } from "@/components/ui/data-table/data-table-column-hide-button";
import {
  DataTableFilterBar,
  type DataTableFilterDefinition,
} from "@/components/ui/data-table/data-table-filter";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import { createSelectColumn } from "@/components/ui/data-table/data-table-select-column";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { resolveGridTableMode } from "@/components/ui/data-table/server-grid/grid-mode";
import type { DataTableServerConfig } from "@/components/ui/data-table/server-grid/types";
import { useSearchCommitter } from "@/components/ui/data-table/server-grid/use-search-committer";
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
  getRowActions?: (row: Row<TData>) => RowAction[];
  getRowLabel?: (row: Row<TData>) => string;
  mobileVariant?: MobileListVariant;
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
  pageSizeOptions?: readonly number[];
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  showSelectionCount?: boolean;
  getRowId?: (originalRow: TData, index: number) => string;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  initialSorting?: SortingState;
  filters?: DataTableFilterDefinition[];
  server?: DataTableServerConfig;
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
  getRowActions,
  getRowLabel,
  mobileVariant,
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
  filters,
  server,
}: DataTableProps<TData, TValue>) {
  const t = useTranslations("DataTable.selection");
  const isMobile = useIsMobile();
  const useCardList = isMobile && Boolean(renderMobileRow);
  const tableMode = resolveGridTableMode(server);
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
  const rowSelection =
    server?.rowSelection ?? rowSelectionProp ?? internalRowSelection;
  const setRowSelection =
    server?.onRowSelectionChange ??
    onRowSelectionChange ??
    setInternalRowSelection;

  // Ref so extending a shift-click range never rebuilds the memoised column list.
  const rangeAnchorRef = React.useRef<string | null>(null);

  const hasSelectColumn = columns.some((column) => column.id === "select");
  const tableColumns = React.useMemo(() => {
    if (!enableRowSelection || hasSelectColumn) {
      return columns;
    }

    return [
      createSelectColumn<TData>({
        labels: { selectAll: t("selectAll"), selectRow: t("selectRow") },
        anchorRef: rangeAnchorRef,
      }),
      ...columns,
    ];
  }, [columns, enableRowSelection, hasSelectColumn, t]);

  React.useEffect(() => {
    if (!enableSearch) {
      setColumnFilters([]);
    }
  }, [enableSearch]);

  // TanStack Table returns functions the React Compiler cannot safely memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
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
      ...(server
        ? { pagination: server.pagination }
        : enablePagination
          ? {}
          : { pagination: { pageIndex: 0, pageSize: data.length } }),
      sorting: server ? server.sorting : sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    manualPagination: tableMode.manualPagination,
    manualSorting: tableMode.manualSorting,
    manualFiltering: tableMode.manualFiltering,
    rowCount: tableMode.rowCount,
    onPaginationChange: server?.onPaginationChange,
    onSortingChange: server ? server.onSortingChange : setSorting,
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

  const [clientSearch, setClientSearch] = React.useState("");
  const pushClientSearch = useSearchCommitter(
    React.useCallback(
      (value: string) => {
        if (searchColumn) {
          table.getColumn(searchColumn)?.setFilterValue(value);
        }
      },
      [searchColumn, table],
    ),
  );

  const handleClientSearch = React.useCallback(
    (value: string) => {
      setClientSearch(value);
      pushClientSearch(value);
    },
    [pushClientSearch],
  );

  const searchValue = server ? server.search : clientSearch;
  const onSearchChange = server ? server.onSearchChange : handleClientSearch;

  const filterDefinitions = React.useMemo(() => filters ?? [], [filters]);
  const clientFilterValues = React.useMemo(() => {
    if (server) {
      return server.filters;
    }

    return Object.fromEntries(
      filterDefinitions.map((definition) => [
        definition.key,
        (table.getColumn(definition.key)?.getFilterValue() as string[]) ?? [],
      ]),
    );
  }, [server, filterDefinitions, table]);

  const handleFilterChange = React.useCallback(
    (key: string, values: string[]) => {
      if (server) {
        server.onFilterChange(key, values);
        return;
      }

      table
        .getColumn(key)
        ?.setFilterValue(values.length > 0 ? values : undefined);
    },
    [server, table],
  );

  const handleClearFilters = React.useCallback(() => {
    if (server) {
      server.onClearFilters();
      return;
    }

    for (const definition of filterDefinitions) {
      table.getColumn(definition.key)?.setFilterValue(undefined);
    }
  }, [server, filterDefinitions, table]);

  const visibleRows = table.getRowModel().rows;
  const isFiltered = server
    ? server.hasActiveQuery
    : columnFilters.length > 0;
  const displayEmptyMessage = isFiltered ? noResultsMessage : emptyMessage;
  const showColumnVisibility = enableColumnVisibility && !useCardList;
  const showFilters = filterDefinitions.length > 0;
  const showInlineToolbar = Boolean(Toolbar) || Boolean(toolbar);
  const showToolbar =
    enableSearch ||
    showFilters ||
    (showInlineToolbar && !useCardList) ||
    Boolean(Toolbar) ||
    showColumnVisibility;
  const shouldShowSelectionCount = showSelectionCount ?? enableRowSelection;
  const isBusy = Boolean(server?.isFetching && server.isPlaceholderData);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3",
        classNameWrapper,
      )}
      data-busy={isBusy ? "true" : undefined}
      aria-busy={isBusy}
    >
      {showToolbar ? (
        <div className="shrink-0">
          <div
            className={cn(
              "flex flex-col gap-2",
              !useCardList &&
                "sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
            )}
          >
            <div
              className={cn(
                "flex w-full flex-col gap-2",
                !useCardList &&
                  "sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
              )}
            >
              {enableSearch && (server || searchColumn) ? (
                <DataTableSearch
                  value={searchValue}
                  onValueChange={onSearchChange}
                  placeholder={searchPlaceholder ?? ""}
                />
              ) : null}
              {showFilters ? (
                <DataTableFilterBar
                  definitions={filterDefinitions}
                  values={clientFilterValues}
                  onChange={handleFilterChange}
                  onClearAll={handleClearFilters}
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
          getRowActions={getRowActions}
          getRowLabel={getRowLabel}
          variant={mobileVariant}
          onRowClick={onRowClick}
          emptyMessage={displayEmptyMessage}
          emptyDescription={isFiltered ? undefined : emptyDescription}
          emptyAction={isFiltered ? undefined : emptyAction}
          className={cn(isBusy && "opacity-60 transition-opacity", className)}
        />
      ) : (
        <div
          className={cn(
            "min-h-0 overflow-auto rounded-md border bg-card shadow-xs",
            isBusy && "opacity-60 transition-opacity",
            className,
          )}
        >
          <Table className="[&_[data-slot=table-head]]:min-h-7 [&_[data-slot=table-head]]:px-1 [&_[data-slot=table-head]]:pt-1 [&_[data-slot=table-head]]:pb-1 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-cell]]:px-1 [&_[data-slot=table-cell]]:py-0.5 [&_[data-slot=table-cell]]:text-xs md:[&_[data-slot=table-head]]:min-h-10 md:[&_[data-slot=table-head]]:px-4 md:[&_[data-slot=table-head]]:pt-2 md:[&_[data-slot=table-head]]:pb-2 md:[&_[data-slot=table-head]]:text-sm md:[&_[data-slot=table-cell]]:px-4 md:[&_[data-slot=table-cell]]:py-2 md:[&_[data-slot=table-cell]]:text-sm">
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
                        header.column.id === "select" && "text-center",
                        header.column.columnDef.meta?.className,
                        "group sticky top-0 z-40 bg-card",
                        header.column.columnDef.meta?.sticky && "left-0 z-50",
                        header.column.columnDef.meta?.hidden && "hidden",
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="inline-flex w-fit max-w-full items-center gap-0.5 align-middle">
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
                          target.closest('[role="checkbox"]') ||
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

      {enablePagination ? (
        <div className="shrink-0">
          <DataTablePagination
            table={table}
            pageSizeOptions={pageSizeOptions}
            showSelectionCount={shouldShowSelectionCount}
            canNavigateForward={!server?.isPlaceholderData}
          />
        </div>
      ) : null}
    </div>
  );
}
