"use client";

import type { FormVersionSummary, RecordItem } from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EMPTY_VALUE } from "@/lib/empty-value";
import { AnswerList } from "@/features/forms/components/answer-list";
import {
  actorName,
  formatOccurrenceDate,
  formatRecordInstant,
  formatRecordTimeOfDay,
} from "@/features/records/lib/format";
import {
  isOnDemand,
  RECORD_DISPLAY_STATE_VARIANT,
  RECORD_RESULT_VARIANT,
  RECORD_TIMING_VARIANT,
  resolvedTiming,
  type RecordsLabels,
} from "@/features/records/lib/labels";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground sm:w-44">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

type RecordDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecordItem | null;
  /** The version the occurrence was recorded against, captured when the detail opened. */
  formVersion: FormVersionSummary | null;
  labels: RecordsLabels;
  locale: string;
  timeZone: string;
};

export function RecordDetailDialog({
  open,
  onOpenChange,
  item,
  formVersion,
  labels,
  locale,
  timeZone,
}: RecordDetailDialogProps) {
  const t = useTranslations("RecordsPage.detail");

  // Kept mounted with `open` toggled so Base UI owns the exit transition.
  if (!item) {
    return null;
  }

  const timing = resolvedTiming(item);
  const onDemand = isOnDemand(item);
  const values = item.record?.values ?? null;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item.title}
      description={`${formatOccurrenceDate(item.entryDate)} · ${item.entryTime}`}
      closeLabel={t("close")}
      className="sm:max-w-lg"
    >
      <dl className="flex flex-col">
        <DetailRow label={onDemand ? t("happened") : t("scheduled")}>
          {formatOccurrenceDate(item.entryDate)} ·{" "}
          <span className="tabular-nums">{item.entryTime}</span>
        </DetailRow>

        {onDemand ? (
          <DetailRow label={t("kind")}>
            <Badge variant="outline">{labels.onDemand}</Badge>
          </DetailRow>
        ) : (
          <>
            {item.availableAt === null ? null : (
              <DetailRow label={t("available")}>
                {formatRecordInstant(item.availableAt, locale, timeZone)}
              </DetailRow>
            )}

            <DetailRow label={t("due")}>
              {item.dueAt === null
                ? t("noDeadline")
                : formatRecordInstant(item.dueAt, locale, timeZone)}
            </DetailRow>
          </>
        )}

        <DetailRow label={t("category")}>
          {labels.category[item.category]}
        </DetailRow>

        <DetailRow label={t("form")}>
          {formVersion
            ? t("formVersion", {
                name: formVersion.formName,
                version: formVersion.version,
              })
            : EMPTY_VALUE}
        </DetailRow>

        {item.targetName ? (
          <DetailRow label={t("target")}>{item.targetName}</DetailRow>
        ) : null}

        <DetailRow label={t("displayState")}>
          <Badge variant={RECORD_DISPLAY_STATE_VARIANT[item.displayState]}>
            {labels.displayState[item.displayState]}
          </Badge>
        </DetailRow>

        <DetailRow label={t("recordState")}>
          {labels.recordState[item.recordState]}
        </DetailRow>

        {onDemand ? null : (
          <DetailRow label={t("timing")}>
            <Badge variant={RECORD_TIMING_VARIANT[timing]}>
              {labels.timing[timing]}
            </Badge>
          </DetailRow>
        )}

        <DetailRow label={t("result")}>
          <Badge variant={RECORD_RESULT_VARIANT[item.result]}>
            {labels.result[item.result]}
          </Badge>
        </DetailRow>

        <DetailRow label={t("answers")}>
          {values ? (
            <AnswerList
              definition={formVersion?.definition ?? null}
              values={values}
              className="-my-2"
            />
          ) : (
            EMPTY_VALUE
          )}
        </DetailRow>

        {item.record?.correctiveAction ? (
          <DetailRow label={t("correctiveAction")}>
            <span className="whitespace-pre-wrap">
              {item.record.correctiveAction}
            </span>
          </DetailRow>
        ) : null}

        <DetailRow label={t("createdBy")}>
          {item.record
            ? `${actorName(item.record.createdBy) ?? EMPTY_VALUE} · ${formatRecordInstant(item.record.createdAt, locale, timeZone)}`
            : EMPTY_VALUE}
        </DetailRow>

        <DetailRow label={t("recordedBy")}>
          {item.record
            ? `${actorName(item.record.recordedBy) ?? EMPTY_VALUE} · ${formatRecordInstant(item.record.recordedAt, locale, timeZone)}`
            : EMPTY_VALUE}
        </DetailRow>

        {item.record?.voidedAt ? (
          <DetailRow label={t("voidedBy")}>
            {`${actorName(item.record.voidedBy) ?? EMPTY_VALUE} · ${formatRecordInstant(item.record.voidedAt, locale, timeZone)}`}
          </DetailRow>
        ) : null}

        <DetailRow label={t("recordedTime")}>
          {item.record
            ? formatRecordTimeOfDay(item.record.recordedAt, locale, timeZone)
            : EMPTY_VALUE}
        </DetailRow>
      </dl>
    </ResponsiveFormDialog>
  );
}
