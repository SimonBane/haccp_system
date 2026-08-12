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
  /** The reading the verdict was judged on — lags the display while typing. */
  settledValue: number | null;
  priorReading: PriorReading | null;
  timeZone: string;
  inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * Step one: what does the thermometer say.
 *
 * Four rows, the same four on every platform: prior reading, the number, the
 * gauge, the verdict. The sign lives inside the readout and the field error
 * inside the status row, which is what keeps it to four.
 *
 * Nothing here is sized against the space a keyboard leaves. The sheet itself
 * shortens when the keyboard opens (see the `[data-side=bottom]` rule in
 * globals.css), so this column simply gets less room and scrolls if it has to,
 * rather than every row having to know the keyboard exists.
 */
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-none md:gap-4">
      {/* Context, never an action: the worker reads the thermometer and types
          what it says. A tap-to-reuse chip here would make copying the previous
          number the fastest path through a log that has to be trustworthy. */}
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
