"use client";

import { GRID_PAGE_SIZE_OPTIONS, type RecordItem } from "@haccp/shared";
import { useCallback, useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { DataTableFilterDefinition } from "@/components/ui/data-table/data-table-filter";
import type { DataTableServerConfig } from "@/components/ui/data-table/server-grid/types";
import {
  getRecordsColumns,
  type RecordsColumnCopy,
} from "@/features/records/data-table/columns";
import { RecordsMobileCard } from "@/features/records/data-table/mobile-card";
import type { RecordsLabels } from "@/features/records/lib/labels";

type RecordsDataProps = {
  items: RecordItem[];
  server: DataTableServerConfig;
  filters: DataTableFilterDefinition[];
  labels: RecordsLabels;
  copy: RecordsColumnCopy;
  locale: string;
  /** Shown when the location has no scheduled work at all in range. */
  emptyMessage: string;
  /** Shown when active filters hide every row of an otherwise non-empty page. */
  noResultsMessage: string;
  onViewDetails: (item: RecordItem) => void;
  toolbarStart?: ReactNode;
  toolbar?: ReactNode;
};

export function RecordsData({
  items,
  server,
  filters,
  labels,
  copy,
  locale,
  emptyMessage,
  noResultsMessage,
  onViewDetails,
  toolbarStart,
  toolbar,
}: RecordsDataProps) {
  const columns = useMemo(
    () => getRecordsColumns({ copy, labels, locale, onViewDetails }),
    [copy, labels, locale, onViewDetails],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof RecordsMobileCard>[0]["row"]) => (
      <RecordsMobileCard row={row} labels={labels} locale={locale} />
    ),
    [labels, locale],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      server={server}
      filters={filters}
      toolbarStart={toolbarStart}
      toolbar={toolbar}
      pageSizeOptions={GRID_PAGE_SIZE_OPTIONS}
      enablePagination
      enableSearch={false}
      enableRowSelection={false}
      enableColumnVisibility={false}
      getRowId={(row) => row.occurrenceId}
      mobileVariant="card"
      emptyMessage={emptyMessage}
      noResultsMessage={noResultsMessage}
      onRowClick={(row) => onViewDetails(row.original)}
      renderMobileRow={renderMobileRow}
      getRowLabel={(row) => row.original.title}
    />
  );
}
