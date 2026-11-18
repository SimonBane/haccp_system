"use client";

import type { MeasurementField, MeasurementLimits } from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  measurementDraftValue,
  type MeasurementDraft,
} from "@/features/forms/lib/answer-draft";
import {
  hasLimits,
  measurementVerdict,
} from "@/features/forms/lib/measurement";
import { MeasurementGauge } from "./measurement-gauge";
import { MeasurementReadout } from "./measurement-readout";
import { MeasurementStatusRow } from "./measurement-status-row";

type Props = {
  idPrefix: string;
  field: MeasurementField;
  limits: MeasurementLimits;
  draft: MeasurementDraft;
  separator: string;
  onChange: (next: MeasurementDraft) => void;
  error?: string | null;
  /** "Last: 3,1 °C at 07:05", or null for the first reading of the day. */
  priorText: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
};

/** A form that is one reading keeps the big readout and gauge a fridge round is built around. */
export function FeaturedMeasurementStep({
  idPrefix,
  field,
  limits,
  draft,
  separator,
  onChange,
  error,
  priorText,
  inputRef,
}: Props) {
  const t = useTranslations("TodayPage.recordDialog");
  const tForms = useTranslations("Forms");
  const format = useAnswerFormat();

  const value = measurementDraftValue(draft);
  const verdict = measurementVerdict(value, limits);
  const statusId = `${idPrefix}-status`;
  const symbol = format.symbol(field.unit);

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 md:flex-none md:justify-start md:gap-4">
      <p className="flex h-5 shrink-0 items-center justify-center text-xs text-muted-foreground landscape:hidden md:landscape:flex">
        {priorText ?? t("noPriorReading")}
      </p>

      <MeasurementReadout
        className="shrink-0 py-2 md:py-0"
        id={`${idPrefix}-${field.id}`}
        unit={field.unit}
        symbol={symbol}
        draft={draft}
        separator={separator}
        verdict={verdict}
        onChange={onChange}
        label={field.label}
        signLabel={tForms("measurement.signToggle")}
        describedById={statusId}
        invalid={Boolean(error)}
        inputRef={inputRef}
      />

      {hasLimits(limits) ? (
        <MeasurementGauge
          className="shrink-0"
          value={value}
          limits={limits}
          unit={field.unit}
          symbol={symbol}
          state={verdict ?? "neutral"}
        />
      ) : null}

      <MeasurementStatusRow
        className="shrink-0"
        id={statusId}
        verdict={verdict}
        valueText={
          value === null ? null : format.measurement(value, field.unit)
        }
        limitsText={format.limits(limits, field.unit)}
        error={error}
      />
    </div>
  );
}
