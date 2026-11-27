"use client";

import { GRID_PAGE_SIZE_OPTIONS, type RecordItem } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import {
  DataTable,
  type DataTableRowGroup,
} from "@/components/ui/data-table/data-table";
import type { DataTableFilterDefinition } from "@/components/ui/data-table/data-table-filter";
import type { DataTableServerConfig } from "@/components/ui/data-table/server-grid/types";
import type { RecordFormat } from "@/features/records/hooks/use-record-format";
import { groupRecordsByDay } from "@/features/records/lib/record-view";
import { getRecordsColumns } from "./columns";

type RecordsDataProps = {
  items: RecordItem[];
  server: DataTableServerConfig;
  filters: DataTableFilterDefinition[];
  format: RecordFormat;
  selectedId: string | null;
  onOpen: (item: RecordItem) => void;
  toolbar: ReactNode;
};

export function RecordsData({
  items,
  server,
  filters,
  format,
  selectedId,
  onOpen,
  toolbar,
}: RecordsDataProps) {
  const t = useTranslations("RecordsPage");

  const columns = useMemo(
    () =>
      getRecordsColumns({
        format,
        onOpen,
        copy: {
          time: t("columns.time"),
          check: t("columns.check"),
          answers: t("columns.answers"),
          recordedBy: t("columns.recordedBy"),
          result: t("columns.result"),
          details: t("columns.details"),
          noReading: t("noReading"),
          notRecorded: t("notRecorded"),
          viewRecord: (name, time) => t("viewRecord", { name, time }),
        },
      }),
    [format, onOpen, t],
  );

  const groups = useMemo(() => {
    const summaries = new Map<string, DataTableRowGroup>();
    for (const day of groupRecordsByDay(items)) {
      summaries.set(day.date, {
        key: day.date,
        label: format.longDay(day.date),
        meta: [
          t("day.checks", { count: day.items.length }),
          ...(day.attention > 0
            ? [t("day.attention", { count: day.attention })]
            : []),
        ].join(" · "),
      });
    }
    return summaries;
  }, [format, items, t]);

  const getRowGroup = useCallback(
    (row: Row<RecordItem>) => groups.get(row.original.entryDate) ?? null,
    [groups],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      server={server}
      filters={filters}
      toolbar={toolbar}
      enableSearch
      searchPlaceholder={t("searchPlaceholder")}
      pageSizeOptions={GRID_PAGE_SIZE_OPTIONS}
      enablePagination
      enableRowSelection={false}
      enableColumnVisibility={false}
      truncateCellValue={false}
      getRowId={(item) => item.id}
      getRowGroup={getRowGroup}
      getRowClassName={(row) =>
        row.original.id === selectedId ? "bg-muted" : undefined
      }
      emptyMessage={t("empty.rangeTitle")}
      emptyDescription={t("empty.rangeDescription")}
      noResultsMessage={t("empty.filteredTitle")}
      onRowClick={(row) => onOpen(row.original)}
      getRowLabel={(row) => format.heading(row.original).primary}
    />
  );
}
