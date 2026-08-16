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
import { useIsMobile } from "@/hooks/use-mobile";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  showSelectionCount?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 25, 30, 40, 50],
  showSelectionCount = false,
}: DataTablePaginationProps<TData>) {
  const t = useTranslations("DataTable.pagination");
  const isMobile = useIsMobile();
  const totalRowsCount = table.getFilteredRowModel().rows.length;
  const currentPageRowsCount = table.getRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  if (isMobile) {
    return (
      <div className="flex items-center justify-between gap-2 px-2">
        <span className="text-sm text-muted-foreground">
          {showSelectionCount
            ? t("rowsSelected", {
                selected: selectedRowsCount,
                total: totalRowsCount,
              })
            : t("rowsCount", {
                current: currentPageRowsCount,
                total: totalRowsCount,
              })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="size-11 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
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
            disabled={!table.getCanNextPage()}
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
          {showSelectionCount
            ? t("rowsSelected", {
                selected: selectedRowsCount,
                total: totalRowsCount,
              })
            : t("rowsCount", {
                current: currentPageRowsCount,
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
            <SelectTrigger size="sm" className="h-8 w-[80px] bg-card">
              <SelectValue>{pageSize}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top">
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
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
