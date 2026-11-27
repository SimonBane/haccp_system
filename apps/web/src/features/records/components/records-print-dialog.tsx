"use client";

import {
  RECORDS_ID_FILTER_MAX,
  RECORDS_REPORT_LAYOUT,
  type AppLocale,
  type RecordsJournalSummary,
} from "@haccp/shared";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  MapPinIcon,
  PrinterIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { RecordsDateRangeControl } from "@/features/records/components/records-date-range";
import { useRecordsJournals } from "@/features/records/hooks/use-records-journals";
import {
  EMPTY_PRINT_SELECTION,
  journalScope,
  printScope,
  printSummary,
  setAllJournals,
  setJournalItems,
  toggleJournal,
  type JournalScope,
  type PrintSelection,
} from "@/features/records/lib/print-selection";
import type { RecordsDateRange } from "@/features/records/lib/records-grid-config";
import {
  buildRecordsJournalsQuery,
  buildRecordsReportUrl,
} from "@/features/records/lib/report-url";
import { useLocation } from "@/features/tenant/tenant-provider";
import { cn } from "@/lib/utils";

type RecordsPrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: RecordsDateRange;
  today: string;
  /** The page's facets; the outcome tabs never narrow a printed journal. */
  filters: GridFilterState;
};

type JournalsState = ReturnType<typeof useRecordsJournals>;

export function RecordsPrintDialog({
  open,
  onOpenChange,
  range,
  today,
  filters,
}: RecordsPrintDialogProps) {
  const locale = useLocale() as AppLocale;
  const { locationId } = useLocation();
  const isMobile = useIsMobile();

  const [period, setPeriod] = useState(range);
  const [selection, setSelection] =
    useState<PrintSelection>(EMPTY_PRINT_SELECTION);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Each opening starts from the page's period; the dialog stays mounted so Base UI can animate it.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriod(range);
      setSelection(EMPTY_PRINT_SELECTION);
      setActiveId(null);
    }
  }

  const journals = useRecordsJournals({
    query: buildRecordsJournalsQuery({ range: period, filters }),
    enabled: open,
  });
  const items = journals.data?.items ?? [];
  const summary = printSummary(items, selection);
  const scope = printScope({ filters, journals: items, selection });
  const href = buildRecordsReportUrl({
    locale,
    locationId,
    range: period,
    layout: RECORDS_REPORT_LAYOUT.JOURNALS,
    filters: scope.filters,
    exclude: scope.exclude,
  });
  // The link carries left-out items; past the API's cap it would be refused.
  const tooManyLeftOut = scope.exclude.length > RECORDS_ID_FILTER_MAX;
  const canPrint = summary.journals > 0 && !tooManyLeftOut;

  const shared = {
    open,
    onOpenChange,
    period,
    setPeriod,
    today,
    journals,
    selection,
    setSelection,
    summary,
    tooManyLeftOut,
    href,
    canPrint,
  };

  return isMobile ? (
    <MobilePrintScreen {...shared} />
  ) : (
    <DesktopPrintDialog
      {...shared}
      activeId={activeId ?? items[0]?.formId ?? null}
      setActiveId={setActiveId}
    />
  );
}

type PrintViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: RecordsDateRange;
  setPeriod: (range: RecordsDateRange) => void;
  today: string;
  journals: JournalsState;
  selection: PrintSelection;
  setSelection: (selection: PrintSelection) => void;
  summary: ReturnType<typeof printSummary>;
  tooManyLeftOut: boolean;
  href: string;
  canPrint: boolean;
};

function PrintButton({
  href,
  canPrint,
  onPrinted,
  className,
}: {
  href: string;
  canPrint: boolean;
  onPrinted: () => void;
  className?: string;
}) {
  const t = useTranslations("RecordsPage.print");
  const content = (
    <>
      <PrinterIcon data-icon="inline-start" />
      {t("submit")}
    </>
  );

  return canPrint ? (
    <Button
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      nativeButton={false}
      className={className}
      onClick={onPrinted}
    >
      {content}
    </Button>
  ) : (
    <Button disabled className={className}>
      {content}
    </Button>
  );
}

function SummaryText({
  summary,
  tooManyLeftOut,
  className,
}: {
  summary: PrintViewProps["summary"];
  tooManyLeftOut: boolean;
  className?: string;
}) {
  const t = useTranslations("RecordsPage.print");
  if (tooManyLeftOut) {
    return (
      <span className={cn("text-destructive", className)}>
        {t("tooManyLeftOut")}
      </span>
    );
  }
  return summary.journals > 0 ? (
    <span className={cn("text-muted-foreground tabular-nums", className)}>
      {t("summary", { journals: summary.journals, entries: summary.entries })}
    </span>
  ) : (
    <span className={cn("text-destructive", className)}>{t("chooseOne")}</span>
  );
}

/** Loading, failure and nothing-to-print, shared by both layouts. */
function JournalsStatus({
  journals,
  children,
}: {
  journals: JournalsState;
  children: (items: RecordsJournalSummary[]) => ReactNode;
}) {
  const t = useTranslations("RecordsPage.print");

  if (journals.isPending) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
    );
  }

  if (journals.isError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {t("journalsError")}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void journals.refetch()}
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (journals.data.items.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">{t("journalsEmpty")}</p>
    );
  }

  return children(journals.data.items);
}

function useScopeText() {
  const t = useTranslations("RecordsPage.print");
  return (scope: JournalScope) => {
    if (!scope.included) return t("notIncluded");
    const items = !scope.hasItems
      ? t("wholeLocation")
      : scope.selectedCount === scope.itemCount
        ? t("scopeAll", { count: scope.itemCount })
        : t("scopePartial", {
            selected: scope.selectedCount,
            total: scope.itemCount,
          });
    return `${items} · ${t("entries", { count: scope.entries })}`;
  };
}

function DesktopPrintDialog({
  open,
  onOpenChange,
  period,
  setPeriod,
  today,
  journals,
  selection,
  setSelection,
  summary,
  tooManyLeftOut,
  href,
  canPrint,
  activeId,
  setActiveId,
}: PrintViewProps & {
  activeId: string | null;
  setActiveId: (id: string) => void;
}) {
  const t = useTranslations("RecordsPage.print");
  const tKinds = useTranslations("TargetsPage.kinds");
  const scopeText = useScopeText();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[40rem] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[57.5rem]"
      >
        <div className="flex items-start justify-between gap-4 pt-5 pr-5 pb-4 pl-6">
          <div className="flex flex-col gap-1.5">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
          <span className="font-medium">{t("period")}</span>
          <RecordsDateRangeControl
            range={period}
            today={today}
            onChange={setPeriod}
          />
        </div>

        <div className="flex min-h-0 flex-1 border-y">
          <JournalsStatus journals={journals}>
            {(items) => {
              const active =
                items.find((journal) => journal.formId === activeId) ??
                items[0]!;
              const activeScope = journalScope(active, selection);

              return (
                <>
                  <div className="flex w-[23.75rem] flex-none flex-col gap-2 overflow-y-auto border-r px-3 py-4">
                    <div className="flex items-center justify-between gap-2 pl-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("journals")}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto py-0"
                        onClick={() =>
                          setSelection(
                            setAllJournals(items, !summary.allIncluded),
                          )
                        }
                      >
                        {summary.allIncluded ? t("clear") : t("selectAll")}
                      </Button>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {items.map((journal) => {
                        const scope = journalScope(journal, selection);
                        const current = journal.formId === active.formId;
                        return (
                          <div
                            key={journal.formId}
                            className={cn(
                              "flex items-center gap-3 rounded-lg pr-1 pl-3 hover:bg-muted/60",
                              current && "bg-muted hover:bg-muted",
                            )}
                          >
                            <Checkbox
                              checked={scope.included}
                              onCheckedChange={() =>
                                setSelection(toggleJournal(selection, journal))
                              }
                              aria-label={t("include", { name: journal.name })}
                            />
                            <button
                              type="button"
                              aria-current={current ? "true" : undefined}
                              onClick={() => setActiveId(journal.formId)}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-2.5 pr-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span
                                  className={cn(
                                    "font-medium",
                                    !scope.included && "text-muted-foreground",
                                  )}
                                >
                                  {journal.name}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {scopeText(scope)}
                                </span>
                              </span>
                              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pt-4 pb-5">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-base font-medium">{active.name}</h3>
                      <p className="text-muted-foreground">
                        {activeScope.hasItems
                          ? t("itemsHint")
                          : t("locationHint")}
                      </p>
                    </div>

                    {activeScope.hasItems ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-accent">
                          <Checkbox
                            checked={
                              activeScope.selectedCount ===
                              activeScope.itemCount
                            }
                            indeterminate={
                              activeScope.selectedCount > 0 &&
                              activeScope.selectedCount < activeScope.itemCount
                            }
                            onCheckedChange={() =>
                              setSelection(
                                setJournalItems(
                                  selection,
                                  active,
                                  active.targets.map((target) => target.targetId),
                                  activeScope.selectedCount <
                                    activeScope.itemCount,
                                ),
                              )
                            }
                          />
                          <span className="flex-1 font-medium">
                            {t("allItems")}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("itemsSelected", {
                              selected: activeScope.selectedCount,
                              total: activeScope.itemCount,
                            })}
                          </span>
                        </label>
                        <Separator />
                        <div className="flex flex-col gap-px">
                          {activeScope.choices.map((choice) => (
                            <label
                              key={choice.key}
                              className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-accent"
                            >
                              <Checkbox
                                checked={activeScope.isChosen(choice)}
                                onCheckedChange={(checked) =>
                                  setSelection(
                                    setJournalItems(
                                      selection,
                                      active,
                                      choice.targetIds,
                                      checked,
                                    ),
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {choice.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {tKinds(choice.kind)}
                              </span>
                              <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                                {t("entries", { count: choice.total })}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Empty>
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <MapPinIcon />
                          </EmptyMedia>
                          <EmptyTitle>{t("wholeLocationTitle")}</EmptyTitle>
                          <EmptyDescription>
                            {t("wholeLocationDescription")}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>
                </>
              );
            }}
          </JournalsStatus>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <SummaryText summary={summary} tooManyLeftOut={tooManyLeftOut} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <PrintButton
              href={href}
              canPrint={canPrint}
              onPrinted={() => onOpenChange(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobilePrintScreen({
  open,
  onOpenChange,
  period,
  setPeriod,
  today,
  journals,
  selection,
  setSelection,
  summary,
  tooManyLeftOut,
  href,
  canPrint,
}: PrintViewProps) {
  const t = useTranslations("RecordsPage.print");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 data-[side=right]:w-full"
      >
        <div className="flex h-14 flex-none items-center gap-1 border-b px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("close")}
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
          </Button>
          <SheetTitle className="flex-1 text-center text-[17px] leading-6 font-semibold">
            {t("mobileTitle")}
          </SheetTitle>
          <span className="w-10" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-6">
          <div className="flex flex-col gap-2.5">
            <span className="font-medium">{t("period")}</span>
            <RecordsDateRangeControl
              range={period}
              today={today}
              onChange={setPeriod}
            />
          </div>

          <JournalsStatus journals={journals}>
            {(items) => (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t("journals")}</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() =>
                      setSelection(setAllJournals(items, !summary.allIncluded))
                    }
                  >
                    {summary.allIncluded ? t("clear") : t("selectAll")}
                  </Button>
                </div>
                {items.map((journal) => (
                  <MobileJournalCard
                    key={journal.formId}
                    journal={journal}
                    selection={selection}
                    setSelection={setSelection}
                    expanded={expandedId === journal.formId}
                    onToggleExpanded={() =>
                      setExpandedId((current) =>
                        current === journal.formId ? null : journal.formId,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </JournalsStatus>
        </div>

        <div className="flex flex-none flex-col gap-2 border-t bg-background px-4 pt-3 pb-5">
          <SummaryText
            summary={summary}
            tooManyLeftOut={tooManyLeftOut}
            className="text-center text-xs"
          />
          <PrintButton
            href={href}
            canPrint={canPrint}
            onPrinted={() => onOpenChange(false)}
            className="h-11 w-full"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileJournalCard({
  journal,
  selection,
  setSelection,
  expanded,
  onToggleExpanded,
}: {
  journal: RecordsJournalSummary;
  selection: PrintSelection;
  setSelection: (selection: PrintSelection) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const t = useTranslations("RecordsPage.print");
  const scope = journalScope(journal, selection);
  const id = `print-journal-${journal.formId}`;
  const hasPicker = scope.choices.length > 1;
  const partial = scope.included && scope.selectedCount < scope.itemCount;
  const meta = partial
    ? t("entriesOf", { selected: scope.entries, total: journal.total })
    : t("entries", { count: journal.total });
  const setItems = (targetIds: string[], checked: boolean) =>
    setSelection(setJournalItems(selection, journal, targetIds, checked));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-14 items-center gap-3 py-2.5 pr-2.5 pl-3.5">
        <Checkbox
          id={id}
          checked={scope.included}
          onCheckedChange={() => setSelection(toggleJournal(selection, journal))}
        />
        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
          <span className="font-medium">{journal.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {meta}
          </span>
        </label>
        {hasPicker ? (
          <Button
            type="button"
            variant="outline"
            aria-expanded={expanded}
            aria-controls={`${id}-items`}
            onClick={onToggleExpanded}
          >
            {scope.selectedCount === 0
              ? t("choose")
              : scope.selectedCount === scope.itemCount
                ? t("scopeAllShort", { count: scope.itemCount })
                : t("scopePartialShort", {
                    selected: scope.selectedCount,
                    total: scope.itemCount,
                  })}
            {expanded ? (
              <ChevronUpIcon data-icon="inline-end" />
            ) : (
              <ChevronDownIcon data-icon="inline-end" />
            )}
          </Button>
        ) : (
          <span className="pr-1 text-xs whitespace-nowrap text-muted-foreground">
            {scope.hasItems ? t("oneItem") : t("wholeLocation")}
          </span>
        )}
      </div>

      {hasPicker && expanded ? (
        <div
          id={`${id}-items`}
          role="group"
          aria-label={t("itemsIn", { name: journal.name })}
          className="flex flex-col border-t pt-1 pr-3 pb-2 pl-3.5"
        >
          <MobileItemRow
            id={`${id}-all`}
            label={t("allItems")}
            strong
            checked={scope.selectedCount === scope.itemCount}
            indeterminate={
              scope.selectedCount > 0 && scope.selectedCount < scope.itemCount
            }
            trailing={t("scopePartialShort", {
              selected: scope.selectedCount,
              total: scope.itemCount,
            })}
            onCheckedChange={() =>
              setItems(
                journal.targets.map((target) => target.targetId),
                scope.selectedCount < scope.itemCount,
              )
            }
          />
          {scope.choices.map((choice) => (
            <MobileItemRow
              key={choice.key}
              id={`${id}-${choice.key}`}
              label={choice.name}
              divided
              checked={scope.isChosen(choice)}
              trailing={String(choice.total)}
              onCheckedChange={(checked) => setItems(choice.targetIds, checked)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileItemRow({
  id,
  label,
  checked,
  indeterminate = false,
  trailing,
  strong = false,
  divided = false,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  trailing: string;
  strong?: boolean;
  divided?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn("flex min-h-11 items-center gap-3", divided && "border-t")}
    >
      <Checkbox
        id={id}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
      />
      <label
        htmlFor={id}
        className={cn("flex-1 cursor-pointer", strong && "font-medium")}
      >
        {label}
      </label>
      <span className="text-xs text-muted-foreground tabular-nums">
        {trailing}
      </span>
    </div>
  );
}
