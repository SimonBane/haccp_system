"use client";

import { useLocale, useTranslations } from "next-intl";
import type { RefObject } from "react";
import { formatTemperature, formatTimeOfDay } from "../lib/format";
import type { TemperatureVerdict } from "../lib/temperature";
import { TemperatureGauge } from "./temperature-gauge";
import { TemperatureReadout } from "./temperature-readout";
import { TemperatureStatusRow } from "./temperature-status-row";

type PriorReading = {
  recordedC: number;
  completedAt: string | null;
  scheduledTime: string;
};

type Props = {
  idPrefix: string;
  minTempC: number;
  maxTempC: number;
  digits: string;
  sign: 1 | -1;
  parsed: number | null;
  separator: string;
  onSignChange: (next: 1 | -1) => void;
  onDigitsChange: (next: string) => void;
  onDraftChange: (next: string) => void;
  error?: string | null;
  verdict: TemperatureVerdict | null;
  /** Settled verdict — lags the display while typing. */
  settledValue: number | null;
  priorReading: PriorReading | null;
  timeZone: string;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function TemperatureReadingStep({
  idPrefix,
  minTempC,
  maxTempC,
  digits,
  sign,
  parsed,
  separator,
  onSignChange,
  onDigitsChange,
  onDraftChange,
  error,
  verdict,
  settledValue,
  priorReading,
  timeZone,
  inputRef,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const statusId = `${idPrefix}-status`;

  const readoutProps = {
    digits,
    sign,
    parsed,
    separator,
    verdict,
    onSignChange,
    onDigitsChange,
    onDraftChange,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 md:flex-none md:justify-start md:gap-4">
      <p className="flex h-5 shrink-0 items-center justify-center text-xs text-muted-foreground landscape:hidden md:landscape:flex">
        {priorReading
          ? t("temperatureDialog.lastReading", {
              value: formatTemperature(priorReading.recordedC, locale),
              time: priorReading.completedAt
                ? formatTimeOfDay(priorReading.completedAt, locale, timeZone)
                : priorReading.scheduledTime,
            })
          : t("temperatureDialog.noPriorReading")}
      </p>

      <TemperatureReadout
        {...readoutProps}
        className="shrink-0 py-2 md:py-0"
        id={`${idPrefix}-recorded-c`}
        describedById={statusId}
        invalid={Boolean(error)}
        inputRef={inputRef}
      />

      <TemperatureGauge
        className="shrink-0"
        value={parsed}
        minTempC={minTempC}
        maxTempC={maxTempC}
        state={verdict ?? "neutral"}
      />

      <TemperatureStatusRow
        className="shrink-0"
        id={statusId}
        verdict={verdict}
        value={settledValue}
        minTempC={minTempC}
        maxTempC={maxTempC}
        error={error}
      />
    </div>
  );
}
