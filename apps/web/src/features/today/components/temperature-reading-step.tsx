"use client";

import { useLocale, useTranslations } from "next-intl";
import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import { formatTemperature, formatTimeOfDay } from "../lib/format";
import {
  composeSignedDraft,
  parseTemperatureDraft,
  type TemperatureVerdict,
} from "../lib/temperature";
import { NumericKeypad } from "./numeric-keypad";
import { TemperatureGauge } from "./temperature-gauge";
import { TemperatureKeypadEntry } from "./temperature-keypad-entry";
import { TemperatureStatusRow } from "./temperature-status-row";
import { TemperatureStepperInput } from "./temperature-stepper-input";

type PriorReading = {
  recordedC: number;
  completedAt: string | null;
  scheduledTime: string;
};

type Props = {
  idPrefix: string;
  minTempC: number;
  maxTempC: number;
  value: string;
  onValueChange: (next: string) => void;
  valueError?: string;
  onValueBlur?: () => void;
  sign: 1 | -1;
  onSignChange: (next: 1 | -1) => void;
  separator: string;
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
 * Everything above the keypad has a fixed height and the keypad takes whatever
 * is left, so the layout is identical on every device and cannot move while a
 * reading is being typed. Mobile and desktop controls are swapped by CSS rather
 * than by a media-query hook, which keeps the inactive one out of the tab order
 * and unaffected by the hydration flip.
 */
export function TemperatureReadingStep({
  idPrefix,
  minTempC,
  maxTempC,
  value,
  onValueChange,
  valueError,
  onValueBlur,
  sign,
  onSignChange,
  separator,
  verdict,
  settledValue,
  priorReading,
  timeZone,
  desktopInputRef,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const recordedC = parseTemperatureDraft(value);
  const statusId = `${idPrefix}-status`;
  const digits = value.replace(/^-/, "");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:justify-center">
      <p className="flex h-5 items-center justify-center text-xs text-muted-foreground">
        {priorReading
          ? t("temperatureDialog.lastReading", {
              value: formatTemperature(priorReading.recordedC, locale),
              time: priorReading.completedAt
                ? formatTimeOfDay(priorReading.completedAt, locale, timeZone)
                : priorReading.scheduledTime,
            })
          : t("temperatureDialog.noPriorReading")}
      </p>

      <TemperatureKeypadEntry
        className="flex-1 md:hidden"
        value={value}
        sign={sign}
        onSignChange={(next) => {
          // The sign has to be stored as well as applied: an empty field has no
          // leading minus to read it back from.
          onSignChange(next);
          onValueChange(composeSignedDraft(next, digits));
        }}
      />

      <TemperatureStepperInput
        className="hidden md:flex"
        id={`${idPrefix}-recorded-c`}
        describedById={statusId}
        value={value}
        onValueChange={onValueChange}
        onBlur={onValueBlur}
        invalid={Boolean(valueError)}
        separator={separator}
        inputRef={desktopInputRef}
      />

      <TemperatureGauge
        value={recordedC}
        minTempC={minTempC}
        maxTempC={maxTempC}
        state={verdict ?? "neutral"}
      />

      <TemperatureStatusRow
        id={statusId}
        verdict={verdict}
        value={settledValue}
        minTempC={minTempC}
        maxTempC={maxTempC}
      />

      <p
        className={cn(
          "h-5 text-center text-sm text-destructive",
          !valueError && "invisible",
        )}
      >
        {valueError}
      </p>

      {/* Capped: left to fill a tall phone the rows grow past 110px each and the
          digits float in space. Whatever it does not take goes to the display. */}
      <NumericKeypad
        className="max-h-80 min-h-0 flex-1 md:hidden"
        digits={digits}
        separator={separator}
        onDigitsChange={(next) => onValueChange(composeSignedDraft(sign, next))}
      />
    </div>
  );
}
