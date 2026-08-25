"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gridPageCount } from "@/components/ui/data-table/server-grid/grid-pagination";
import { useIsMobile } from "@/hooks/use-mobile";
import { GRID_PAGE_SIZE_OPTIONS } from "@haccp/shared";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: readonly number[];
  showSelectionCount?: boolean;
  canNavigateForward?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = GRID_PAGE_SIZE_OPTIONS,
  showSelectionCount = false,
  canNavigateForward = true,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("DataTable.pagination");
  const isMobile = useIsMobile();
  const totalRowsCount = table.getRowCount();
  const currentPageRowsCount = table.getRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length;
  // Selecting rows swaps the count in place rather than adding a second phrase —
  // "row(s)" never becomes "row(s) selected.".
  const displayRowsCount =
    showSelectionCount && selectedRowsCount > 0
      ? selectedRowsCount
      : currentPageRowsCount;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = gridPageCount(totalRowsCount, pageSize);
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage() && canNavigateForward;

  if (isMobile) {
    return (
      <div className="flex items-center justify-between gap-2 px-2">
        <span className="text-sm text-muted-foreground">
          {t("rowsCount", {
            current: displayRowsCount,
            total: totalRowsCount,
          })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="size-11 p-0"
            onClick={() => table.previousPage()}
            disabled={!canPreviousPage}
            aria-label={t("previousPage")}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-16 text-center text-sm font-medium">
            {t("pageCount", {
              current: pageIndex + 1,
              total: pageCount,
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            className="size-11 p-0"
            onClick={() => table.nextPage()}
            disabled={!canNextPage}
            aria-label={t("nextPage")}
            data-testid="data-table-next-page"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between gap-2 px-2 md:flex-row md:items-center">
      <div className="flex-1 text-sm text-muted-foreground">
        <span>
          {t("rowsCount", {
            current: displayRowsCount,
            total: totalRowsCount,
          })}
        </span>
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{t("rowsPerPage")}</p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value: unknown) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger size="sm" className="h-8 w-[70px] bg-card">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top" alignItemWithTrigger={false}>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-center text-sm font-medium">
          {t("pageCount", {
            current: pageIndex + 1,
            total: pageCount,
          })}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!canPreviousPage}
            aria-label={t("firstPage")}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!canPreviousPage}
            aria-label={t("previousPage")}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!canNextPage}
            aria-label={t("nextPage")}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!canNextPage}
            aria-label={t("lastPage")}
          >
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
