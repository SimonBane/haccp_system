"use client";

import type { RecordItem, UserSummary } from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  EM_DASH,
  formatOccurrenceDate,
  formatRecordInstant,
  formatRecordTimeOfDay,
  formatTemperatureRange,
  formatTemperatureValue,
} from "@/features/records/lib/format";
import {
  RECORD_DISPLAY_STATE_VARIANT,
  RECORD_RESULT_VARIANT,
  RECORD_TIMING_VARIANT,
  resolvedTiming,
  type RecordsLabels,
} from "@/features/records/lib/labels";

function actorName(user: UserSummary | null): string | null {
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name === "" ? null : name;
}

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
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

type RecordDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecordItem | null;
  labels: RecordsLabels;
  locale: string;
  timeZone: string;
};

export function RecordDetailDialog({
  open,
  onOpenChange,
  item,
  labels,
  locale,
  timeZone,
}: RecordDetailDialogProps) {
  const t = useTranslations("RecordsPage.detail");

  // Kept mounted with `open` toggled so Base UI owns the exit transition.
  if (!item) {
    return null;
  }

  const isTemperature = item.type === "temperature";
  const temperature = item.record?.temperature ?? null;
  const permittedRange = formatTemperatureRange(
    temperature?.minTempC ?? item.minTempC,
    temperature?.maxTempC ?? item.maxTempC,
    locale,
  );
  const timing = resolvedTiming(item);

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item.title}
      description={`${formatOccurrenceDate(item.occurrenceDate)} · ${item.scheduledTime}`}
      closeLabel={t("close")}
      className="sm:max-w-lg"
    >
      <dl className="flex flex-col">
        <DetailRow label={t("scheduled")}>
          {formatOccurrenceDate(item.occurrenceDate)} ·{" "}
          <span className="tabular-nums">{item.scheduledTime}</span>
        </DetailRow>

        <DetailRow label={t("available")}>
          {formatRecordInstant(item.availableAt, locale, timeZone)}
        </DetailRow>

        <DetailRow label={t("due")}>
          {item.dueAt === null
            ? t("noDeadline")
            : formatRecordInstant(item.dueAt, locale, timeZone)}
        </DetailRow>

        <DetailRow label={t("type")}>{labels.type[item.type]}</DetailRow>

        {isTemperature ? (
          <DetailRow label={t("monitoringPoint")}>
            {item.equipmentName ?? EM_DASH}
          </DetailRow>
        ) : null}

        <DetailRow label={t("displayState")}>
          <Badge variant={RECORD_DISPLAY_STATE_VARIANT[item.displayState]}>
            {labels.displayState[item.displayState]}
          </Badge>
        </DetailRow>

        <DetailRow label={t("recordState")}>
          {labels.recordState[item.recordState]}
        </DetailRow>

        <DetailRow label={t("timing")}>
          <Badge variant={RECORD_TIMING_VARIANT[timing]}>
            {labels.timing[timing]}
          </Badge>
        </DetailRow>

        {isTemperature ? (
          <DetailRow label={t("result")}>
            <Badge variant={RECORD_RESULT_VARIANT[item.result]}>
              {labels.result[item.result]}
            </Badge>
          </DetailRow>
        ) : null}

        {isTemperature ? (
          <DetailRow label={t("reading")}>
            {temperature
              ? formatTemperatureValue(temperature.recordedC, locale)
              : EM_DASH}
          </DetailRow>
        ) : null}

        {isTemperature ? (
          <DetailRow label={t("permittedRange")}>
            {permittedRange ?? EM_DASH}
          </DetailRow>
        ) : null}

        {temperature?.correctiveAction ? (
          <DetailRow label={t("correctiveAction")}>
            <span className="whitespace-pre-wrap">
              {temperature.correctiveAction}
            </span>
          </DetailRow>
        ) : null}

        <DetailRow label={t("createdBy")}>
          {item.record
            ? `${actorName(item.record.createdBy) ?? EM_DASH} · ${formatRecordInstant(item.record.createdAt, locale, timeZone)}`
            : EM_DASH}
        </DetailRow>

        <DetailRow label={t("recordedBy")}>
          {item.record
            ? `${actorName(item.record.recordedBy) ?? EM_DASH} · ${formatRecordInstant(item.record.recordedAt, locale, timeZone)}`
            : EM_DASH}
        </DetailRow>

        {item.record?.voidedAt ? (
          <DetailRow label={t("voidedBy")}>
            {`${actorName(item.record.voidedBy) ?? EM_DASH} · ${formatRecordInstant(item.record.voidedAt, locale, timeZone)}`}
          </DetailRow>
        ) : null}

        <DetailRow label={t("recordedTime")}>
          {item.record
            ? formatRecordTimeOfDay(item.record.recordedAt, locale, timeZone)
            : EM_DASH}
        </DetailRow>
      </dl>
    </ResponsiveFormDialog>
  );
}
