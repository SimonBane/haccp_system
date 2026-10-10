"use client";

import {
  FORM_CATEGORY_VALUES,
  type AppLocale,
  type FormCategory,
  type FormVersionSummary,
  type RecordItem,
  type RecordsListResponse,
} from "@haccp/shared";
import { PrinterIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { ApiQueryError } from "@/components/api-query-error";
import { MobileHeaderActions } from "@/components/layout/shell-slots";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { RecordDetailDialog } from "@/features/records/components/record-detail-dialog";
import { RecordsDateRangeControl } from "@/features/records/components/records-date-range";
import type {
  RecordsColumnCopy,
  SummarizeRecord,
} from "@/features/records/data-table/columns";
import { RecordsData } from "@/features/records/data-table/data";
import { useRecordsGrid } from "@/features/records/hooks/use-records-grid";
import type { RecordsLabels } from "@/features/records/lib/labels";
import { buildRecordsFilterDefinitions } from "@/features/records/lib/records-filters";
import type { RecordsDateRange } from "@/features/records/lib/records-grid-config";
import { buildRecordsReportUrl } from "@/features/records/lib/report-url";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  describeAnswers,
  summarizeAnswers,
} from "@/features/forms/lib/answer-summary";

type RecordsViewProps = {
  initialPage: RecordsListResponse;
  initialLocationId: string;
  initialRange: RecordsDateRange;
  today: string;
};

function PrintReportAction({ href, label }: { href: string; label: string }) {
  return (
    <Button
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      nativeButton={false}
      variant="outline"
    >
      <PrinterIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}

function MobilePrintReportAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <MobileHeaderActions>
      <Button
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
        variant="outline"
        size="icon-lg"
        aria-label={label}
        className="shrink-0 rounded-lg border-sidebar-border bg-transparent text-foreground shadow-none hover:bg-transparent"
      >
        <PrinterIcon className="size-5" />
      </Button>
    </MobileHeaderActions>
  );
}

export function RecordsView({
  initialPage,
  initialLocationId,
  initialRange,
  today,
}: RecordsViewProps) {
  const t = useTranslations("RecordsPage");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const format = useAnswerFormat();
  const { organization, selectedLocation, locationId } = useTenant();

  const grid = useRecordsGrid({
    initialPage,
    initialLocationId,
    initialRange,
    today,
  });

  const [detail, setDetail] = useState<{
    item: RecordItem;
    formVersion: FormVersionSummary | null;
    datasetKey: string;
    open: boolean;
  } | null>(null);

  // Derived, not an effect: location, range, filter, sort and page changes all replace
  // the dataset behind an open detail, so it closes in the same render.
  const detailOpen =
    detail !== null && detail.open && detail.datasetKey === grid.datasetKey;

  const openDetail = useCallback(
    (item: RecordItem) =>
      setDetail({
        item,
        formVersion: grid.formVersions[item.formVersionId] ?? null,
        datasetKey: grid.datasetKey,
        open: true,
      }),
    [grid.datasetKey, grid.formVersions],
  );

  // Only `open` is cleared — dropping the item would cut the exit transition short.
  const closeDetail = useCallback(
    () =>
      setDetail((current) => (current ? { ...current, open: false } : current)),
    [],
  );

  const labels = useMemo<RecordsLabels>(
    () => ({
      displayState: {
        submitted: t("displayState.submitted"),
        missed: t("displayState.missed"),
        voided: t("displayState.voided"),
        open: t("displayState.open"),
      },
      recordState: {
        none: t("recordState.none"),
        submitted: t("recordState.submitted"),
        voided: t("recordState.voided"),
      },
      timing: {
        not_submitted: t("timing.notSubmitted"),
        on_time: t("timing.onTime"),
        late: t("timing.late"),
        no_deadline: t("timing.noDeadline"),
      },
      result: {
        pass: t("result.pass"),
        fail: t("result.fail"),
        not_evaluated: t("result.notEvaluated"),
      },
      category: Object.fromEntries(
        FORM_CATEGORY_VALUES.map((category) => [
          category,
          tForms(`categories.${category}`),
        ]),
      ) as Record<FormCategory, string>,
    }),
    [t, tForms],
  );

  const summarize = useCallback<SummarizeRecord>(
    (item) =>
      item.record
        ? summarizeAnswers(
            describeAnswers(
              grid.formVersions[item.formVersionId]?.definition ?? null,
              item.record.values,
              format.answers,
            ),
          )
        : null,
    [format, grid.formVersions],
  );

  const columnCopy = useMemo<RecordsColumnCopy>(
    () => ({
      dateTime: t("columns.dateTime"),
      task: t("columns.task"),
      status: t("columns.status"),
      timing: t("columns.timing"),
      answers: t("columns.answers"),
      result: t("columns.result"),
      viewDetails: t("viewDetails"),
    }),
    [t],
  );

  const filterDefinitions = useMemo(
    () =>
      buildRecordsFilterDefinitions({
        labels: {
          category: t("filters.category"),
          state: t("filters.state"),
          result: t("filters.result"),
          categoryOptions: labels.category,
          stateOptions: {
            submitted: labels.displayState.submitted,
            missed: labels.displayState.missed,
            voided: labels.displayState.voided,
            open: labels.displayState.open,
          },
          resultOptions: labels.result,
        },
      }),
    [labels, t],
  );

  const reportUrl = buildRecordsReportUrl({
    locale: locale as AppLocale,
    locationId,
    range: grid.range,
    filters: grid.server.filters,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MobilePrintReportAction href={reportUrl} label={t("printReport")} />

      <PageHeader title={t("title")} description={t("description")} />

      {organization.multipleLocationsEnabled ? (
        <p className="text-sm text-muted-foreground">
          {t("locationContext", { location: selectedLocation.name })}
        </p>
      ) : null}

      {grid.isLoading ? (
        <DataTableSkeleton columns={6} />
      ) : grid.isError ? (
        <ApiQueryError error={grid.error} onRetry={() => void grid.refetch()} />
      ) : (
        <RecordsData
          items={grid.items}
          server={grid.server}
          filters={filterDefinitions}
          labels={labels}
          copy={columnCopy}
          summarize={summarize}
          emptyMessage={t("emptyRange")}
          noResultsMessage={t("emptyFiltered")}
          onViewDetails={openDetail}
          toolbarStart={
            <RecordsDateRangeControl
              range={grid.range}
              today={today}
              onChange={grid.setRange}
            />
          }
          toolbar={
            <PrintReportAction href={reportUrl} label={t("printReport")} />
          }
        />
      )}

      <RecordDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        item={detail?.item ?? null}
        formVersion={detail?.formVersion ?? null}
        labels={labels}
        locale={locale}
        timeZone={organization.timezone}
      />
    </div>
  );
}
