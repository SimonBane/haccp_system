"use client";

import type { RecordItem, RecordsListResponse } from "@haccp/shared";
import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { ApiQueryError } from "@/components/api-query-error";
import { MobileHeaderActions } from "@/components/layout/shell-slots";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { RecordSheet } from "@/features/records/components/record-sheet";
import { RecordsDateRangeControl } from "@/features/records/components/records-date-range";
import { RecordsMobileList } from "@/features/records/components/records-mobile-list";
import { RecordsPrintDialog } from "@/features/records/components/records-print-dialog";
import { RecordsData } from "@/features/records/data-table/data";
import { useRecordFormat } from "@/features/records/hooks/use-record-format";
import { useRecordsFilterOptions } from "@/features/records/hooks/use-records-filter-options";
import { useRecordsGrid } from "@/features/records/hooks/use-records-grid";
import { useRecordsList } from "@/features/records/hooks/use-records-list";
import {
  isSameRecordsRange,
  recordsRangeError,
} from "@/features/records/lib/date-range";
import {
  buildRecordsFilterDefinitions,
  RECORDS_FACET_KEYS,
} from "@/features/records/lib/records-filters";
import type { RecordsDateRange } from "@/features/records/lib/records-grid-config";
import { useTenant } from "@/features/tenant/tenant-provider";
import { cn } from "@/lib/utils";

type RecordsViewProps = {
  initialPage: RecordsListResponse;
  initialLocationId: string;
  initialRange: RecordsDateRange;
  today: string;
};

export function RecordsView({
  initialPage,
  initialLocationId,
  initialRange,
  today,
}: RecordsViewProps) {
  const t = useTranslations("RecordsPage");
  const tReport = useTranslations("RecordsReportPage");
  const isMobile = useIsMobile();
  const { organization, selectedLocation, locations } = useTenant();
  const filterOptions = useRecordsFilterOptions();

  const [range, setRangeState] = useState(initialRange);
  const setRange = useCallback(
    (next: RecordsDateRange) => {
      if (recordsRangeError(next, today)) return;
      setRangeState((current) =>
        isSameRecordsRange(current, next) ? current : next,
      );
    },
    [today],
  );

  // One layout is on screen at a time, so only its query runs.
  const grid = useRecordsGrid({
    initialPage,
    initialLocationId,
    initialRange,
    range,
    enabled: !isMobile,
  });
  const list = useRecordsList({
    initialPage,
    initialLocationId,
    initialRange,
    range,
    enabled: isMobile,
  });
  const active = isMobile
    ? {
        items: list.items,
        formVersions: list.formVersions,
        datasetKey: list.datasetKey,
      }
    : {
        items: grid.items,
        formVersions: grid.formVersions,
        datasetKey: grid.datasetKey,
      };
  const format = useRecordFormat({
    formVersions: active.formVersions,
    today,
  });

  const [printOpen, setPrintOpen] = useState(false);
  const openPrint = useCallback(() => setPrintOpen(true), []);

  const [detail, setDetail] = useState<{
    item: RecordItem;
    datasetKey: string;
    open: boolean;
  } | null>(null);
  // Derived, not an effect: a new range, filter, sort, page or location replaces the rows behind an open record.
  const detailOpen =
    detail !== null && detail.open && detail.datasetKey === active.datasetKey;
  const openDetail = useCallback(
    (item: RecordItem) =>
      setDetail({ item, datasetKey: active.datasetKey, open: true }),
    [active.datasetKey],
  );
  // Only `open` is cleared — dropping the item would cut the exit transition short.
  const closeDetail = useCallback(
    () =>
      setDetail((current) => (current ? { ...current, open: false } : current)),
    [],
  );

  const filterDefinitions = useMemo(
    () =>
      buildRecordsFilterDefinitions({
        options: filterOptions.data,
        labels: {
          form: t("filters.form"),
          target: t("filters.target"),
          recordedBy: t("filters.recordedBy"),
          status: t("filters.status"),
          statusOptions: {
            passed: t("outcome.passed"),
            attention: t("outcome.attention"),
            recorded: t("outcome.recorded"),
            missed: t("outcome.missed"),
            voided: t("outcome.voided"),
            open: t("outcome.open"),
          },
          archived: (name) => t("filters.archived", { name }),
          unknownUser: tReport("unknownUser"),
        },
      }),
    [filterOptions.data, t, tReport],
  );

  // The print dialog follows the item facets only; status and search never narrow a journal.
  const gridFilters = grid.server.filters;
  const printFilters = useMemo(() => {
    if (isMobile) return {};
    const facets: GridFilterState = {};
    for (const key of RECORDS_FACET_KEYS) {
      if (gridFilters[key]) facets[key] = gridFilters[key];
    }
    return facets;
  }, [gridFilters, isMobile]);

  const multipleLocations =
    organization.multipleLocationsEnabled && locations.length > 1;

  const dateControl = (
    <RecordsDateRangeControl range={range} today={today} onChange={setRange} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <PageHeader
        title={t("title")}
        description={t("description", { location: selectedLocation.name })}
        actions={
          isMobile ? null : (
            <Button type="button" onClick={openPrint}>
              <PrinterIcon data-icon="inline-start" />
              {t("printReport")}
            </Button>
          )
        }
      />
      {isMobile ? (
        <MobileHeaderActions>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("printReport")}
            className="shrink-0 rounded-lg border-sidebar-border bg-transparent text-foreground shadow-none hover:bg-transparent"
            onClick={openPrint}
          >
            <PrinterIcon className="size-5" />
          </Button>
        </MobileHeaderActions>
      ) : null}

      {isMobile ? (
        <div className="flex flex-col gap-4">
          {dateControl}
          {list.isPending ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <ApiQueryError
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("empty.rangeTitle")}</EmptyTitle>
                <EmptyDescription>{t("empty.rangeDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              className={cn(
                "flex flex-col gap-4 transition-opacity",
                list.isPlaceholderData && "opacity-60",
              )}
            >
              <RecordsMobileList
                items={list.items}
                format={format}
                onOpen={openDetail}
              />
              {list.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 w-full"
                  disabled={list.isFetchingMore}
                  onClick={list.showMore}
                >
                  {t("showMore")}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : grid.isLoading ? (
        <DataTableSkeleton columns={6} />
      ) : grid.isError ? (
        <ApiQueryError error={grid.error} onRetry={() => void grid.refetch()} />
      ) : (
        <RecordsData
          items={grid.items}
          server={grid.server}
          filters={filterDefinitions}
          format={format}
          selectedId={detailOpen ? (detail?.item.id ?? null) : null}
          onOpen={openDetail}
          toolbar={dateControl}
        />
      )}

      <RecordsPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        range={range}
        today={today}
        filters={printFilters}
      />

      <RecordSheet
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        item={detail?.item ?? null}
        siblings={active.items}
        onNavigate={openDetail}
        formVersion={
          detail
            ? (active.formVersions[detail.item.formVersionId] ?? null)
            : null
        }
        format={format}
        locationName={multipleLocations ? selectedLocation.name : null}
      />
    </div>
  );
}
