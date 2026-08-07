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
  desktopInputRef: RefObject<HTMLInputElement | null>;
};

/**
 * Step one: what does the thermometer say.
 *
 * Four rows above the keypad instead of six. The sign moved into the readout and
 * the field error moved into the status row, which gave about 56px back to the
 * digits and the keys on a phone. Everything above the keypad still has a fixed
 * height and the keypad takes whatever is left, so the layout cannot move while
 * a reading is being typed.
 *
 * Mobile and desktop controls are swapped by CSS rather than by a media-query
 * hook, which keeps the inactive one out of the tab order and unaffected by the
 * hydration flip. Only the desktop variant carries the id.
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
  desktopInputRef,
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

      {/* Capped as well as flexible. Sharing the spare height evenly with the
          keypad left a 60px number floating in 260px of air while the keys
          stayed cramped; the keys are what gets aimed at with cold hands, so
          they win the surplus. */}
      <TemperatureReadout
        {...readoutProps}
        variant="display"
        className="min-h-20 max-h-40 flex-1 md:hidden landscape:min-h-14 landscape:max-h-24"
      />

      <TemperatureReadout
        {...readoutProps}
        variant="input"
        className="hidden shrink-0 md:flex"
        id={`${idPrefix}-recorded-c`}
        describedById={statusId}
        invalid={Boolean(error)}
        inputRef={desktopInputRef}
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
