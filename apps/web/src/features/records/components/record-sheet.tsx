"use client";

import {
  RECORD_DISPLAY_STATE,
  RECORD_TIMING,
  type FormVersionSummary,
  type RecordItem,
} from "@haccp/shared";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { LimitChip } from "@/features/forms/components/limit-chip";
import type { RecordFormat } from "@/features/records/hooks/use-record-format";
import {
  readingScale,
  recordHistory,
  recordReadings,
  RECORD_EVENT,
  type RecordEvent,
  type RecordReading,
} from "@/features/records/lib/record-view";
import { isOnDemand } from "@/features/records/lib/labels";
import { cn } from "@/lib/utils";
import { RecordOutcomeBadge } from "./record-outcome-badge";

type RecordSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecordItem | null;
  /** The rows prev/next step through: the table's page, or everything loaded on a phone. */
  siblings: readonly RecordItem[];
  onNavigate: (item: RecordItem) => void;
  formVersion: FormVersionSummary | null;
  format: RecordFormat;
  /** Named only when the organization has more than one. */
  locationName: string | null;
};

export function RecordSheet({
  open,
  onOpenChange,
  item,
  siblings,
  onNavigate,
  formVersion,
  format,
  locationName,
}: RecordSheetProps) {
  const t = useTranslations("RecordsPage.record");
  const isMobile = useIsMobile();

  const index = item ? siblings.findIndex((row) => row.id === item.id) : -1;
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 ? siblings[index + 1] : undefined;
  const heading = item ? format.heading(item) : null;
  const subtitle = item
    ? [heading!.secondary, format.shortDay(item.entryDate), item.entryTime].join(
        " · ",
      )
    : null;

  // Kept mounted with `open` toggled so Base UI owns the exit transition.
  return (
    <ResponsiveFormSheet
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={t("close")}
      title={
        item && !isMobile ? (
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">{heading!.primary}</span>
            <RecordOutcomeBadge item={item} />
          </span>
        ) : (
          (heading?.primary ?? t("details"))
        )
      }
      description={subtitle}
      footer={
        item ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!previous}
              onClick={() => previous && onNavigate(previous)}
            >
              <ChevronUpIcon data-icon="inline-start" />
              {t("previous")}
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {index >= 0
                ? t("position", { index: index + 1, total: siblings.length })
                : null}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!next}
              onClick={() => next && onNavigate(next)}
            >
              {t("next")}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>
        ) : null
      }
    >
      {item ? (
        <RecordBody
          item={item}
          formVersion={formVersion}
          format={format}
          locationName={locationName}
          // The phone's app bar has room for the name only.
          intro={
            isMobile ? (
              <div className="flex items-start justify-between gap-3">
                <p className="text-muted-foreground">{subtitle}</p>
                <RecordOutcomeBadge item={item} />
              </div>
            ) : null
          }
        />
      ) : null}
    </ResponsiveFormSheet>
  );
}

function RecordBody({
  item,
  formVersion,
  format,
  locationName,
  intro,
}: {
  item: RecordItem;
  formVersion: FormVersionSummary | null;
  format: RecordFormat;
  locationName: string | null;
  intro: ReactNode;
}) {
  const t = useTranslations("RecordsPage.record");
  const tForms = useTranslations("Forms");
  const definition = formVersion?.definition ?? null;
  const readings = recordReadings(item, definition);
  const readingIds = new Set(readings.map((reading) => reading.fieldId));
  const answers = format
    .lines(item)
    .filter((line) => !readingIds.has(line.fieldId));
  const voided = item.displayState === RECORD_DISPLAY_STATE.VOIDED;
  const note =
    item.displayState === RECORD_DISPLAY_STATE.MISSED
      ? t("missedNote")
      : item.displayState === RECORD_DISPLAY_STATE.OPEN
        ? t("openNote")
        : null;
  const correctiveAction = item.record?.correctiveAction ?? null;
  const history = recordHistory(item);

  const facts: [string, string][] = [
    [
      t("form"),
      formVersion
        ? t("formVersion", {
            name: formVersion.formName,
            version: formVersion.version,
          })
        : item.title,
    ],
    [t("target"), item.targetName ?? format.heading(item).secondary],
    [t("category"), tForms(`categories.${item.category}`)],
    [t("type"), isOnDemand(item) ? t("onDemand") : t("scheduled")],
    ...(locationName ? [[t("location"), locationName] as [string, string]] : []),
  ];

  return (
    <div className="flex flex-col gap-7">
      {intro}

      {readings.map((reading) => (
        <ReadingCard key={reading.fieldId} reading={reading} voided={voided} />
      ))}

      {note ? (
        <p className="rounded-lg border px-4 py-3.5">{note}</p>
      ) : null}

      {answers.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="mb-1 text-sm font-semibold">{t("answers")}</h3>
          <dl className="flex flex-col">
            {answers.map((line) => (
              <div
                key={line.fieldId}
                className="flex justify-between gap-4 border-b py-2.5"
              >
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd
                  className={cn(
                    "text-right font-medium",
                    line.fails && "text-destructive",
                  )}
                >
                  {line.text}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {correctiveAction && item.record ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t("correctiveAction")}</h3>
          <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3.5">
            <p className="whitespace-pre-wrap">{correctiveAction}</p>
            <span className="text-xs text-muted-foreground">
              {format.person(item.record.recordedBy)} ·{" "}
              {format.time(item.record.recordedAt)}
            </span>
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t("history")}</h3>
          <ol className="flex flex-col">
            {history.map((event, position) => (
              <HistoryEntry
                key={`${event.kind}-${position}`}
                event={event}
                item={item}
                format={format}
                last={position === history.length - 1}
              />
            ))}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col gap-1">
        <h3 className="mb-1 text-sm font-semibold">{t("details")}</h3>
        <dl className="flex flex-col">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b py-2.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ReadingCard({
  reading,
  voided,
}: {
  reading: RecordReading;
  voided: boolean;
}) {
  const t = useTranslations("RecordsPage.record");
  const format = useAnswerFormat();
  const limits = format.limits(reading.limits, reading.unit);
  const scale = readingScale(reading);
  const verdict = voided ? null : reading.fails ? "fail" : "pass";

  return (
    <section
      aria-label={reading.label}
      className="flex flex-col gap-3.5 rounded-2xl border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-muted-foreground">
            {reading.label}
          </span>
          <span
            className={cn(
              "text-5xl leading-none font-semibold tracking-tight tabular-nums",
              voided && "text-muted-foreground line-through",
            )}
          >
            {format.measurement(reading.value, reading.unit)}
          </span>
        </div>
        {limits ? (
          <LimitChip
            limits={limits}
            unit={reading.unit}
            label={t("allowed", { limits })}
            verdict={limits ? verdict : null}
          />
        ) : null}
      </div>
      {scale ? (
        <div aria-hidden className="relative mt-1 h-[34px]">
          <div className="absolute inset-x-0 top-1 h-2 rounded-full bg-muted" />
          <div
            className="absolute top-1 h-2 rounded-full bg-success/45"
            style={{
              left: `${scale.bandStart}%`,
              width: `${scale.bandEnd - scale.bandStart}%`,
            }}
          />
          <div
            className={cn(
              "absolute top-0 size-4 rounded-full border-3 border-popover",
              verdict === "fail" ? "bg-destructive" : "bg-foreground",
            )}
            style={{ left: `calc(${scale.marker}% - 0.5rem)` }}
          />
          {scale.ticks.map((tick) => (
            <span
              key={tick.value}
              className="absolute top-[18px] -translate-x-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              style={{ left: `${tick.position}%` }}
            >
              {format.measurement(tick.value, reading.unit)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function HistoryEntry({
  event,
  item,
  format,
  last,
}: {
  event: RecordEvent;
  item: RecordItem;
  format: RecordFormat;
  last: boolean;
}) {
  const t = useTranslations("RecordsPage.record");
  const name = format.person(event.actor);
  const text = (() => {
    switch (event.kind) {
      case RECORD_EVENT.SCHEDULED:
        return item.dueAt
          ? t("events.scheduledDue", { time: format.time(item.dueAt) })
          : t("events.scheduled");
      case RECORD_EVENT.RECORDED:
        return t("events.recorded", { name });
      case RECORD_EVENT.UPDATED:
        return t("events.updated", { name });
      case RECORD_EVENT.CORRECTIVE_ACTION:
        return t("events.correctiveAction", { name });
      case RECORD_EVENT.VOIDED:
        return t("events.voided", { name });
      case RECORD_EVENT.MISSED:
        return t("events.missed");
    }
  })();

  return (
    <li className="grid grid-cols-[3rem_1rem_minmax(0,1fr)] gap-x-2.5">
      <span className="text-muted-foreground tabular-nums">
        {event.at ? format.time(event.at) : item.entryTime}
      </span>
      <span aria-hidden className="flex flex-col items-center">
        <span className="mt-1.5 size-2 rounded-full bg-foreground" />
        {last ? null : <span className="mt-1 w-px flex-1 bg-border" />}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 pb-4">
        {text}
        {event.timing ? (
          <Badge
            variant={event.timing === RECORD_TIMING.LATE ? "warning" : "success"}
          >
            {event.timing === RECORD_TIMING.LATE ? t("late") : t("onTime")}
          </Badge>
        ) : null}
      </span>
    </li>
  );
}
