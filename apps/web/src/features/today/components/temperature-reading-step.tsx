"use client";

import { classifyTemperatureResult } from "@haccp/shared";
import { CheckIcon, CircleAlertIcon, DeleteIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { decimalSeparator } from "../lib/format";
import {
  hasCorrectiveActionPreset,
  parseLocalizedTemperature,
  toggleCorrectiveActionPreset,
} from "../lib/temperature";
import { NumericKeypad } from "./numeric-keypad";
import { TemperatureRangeMeter } from "./temperature-range-meter";

const PRESET_KEYS = [
  "movedProduct",
  "adjustedThermostat",
  "notifiedManager",
  "calledService",
] as const;

type Props = {
  idPrefix: string;
  minTempC: number;
  maxTempC: number;
  value: string;
  onValueChange: (next: string) => void;
  valueError?: string;
  correctiveAction: string;
  onCorrectiveActionChange: (next: string) => void;
  correctiveActionError?: string;
  onValueBlur?: () => void;
  onCorrectiveActionBlur?: () => void;
};

/**
 * One reading, fully controlled. The batch "record the whole round" flow can
 * mount several of these behind a stepper without changing anything here.
 */
export function TemperatureReadingStep({
  idPrefix,
  minTempC,
  maxTempC,
  value,
  onValueChange,
  valueError,
  correctiveAction,
  onCorrectiveActionChange,
  correctiveActionError,
  onValueBlur,
  onCorrectiveActionBlur,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);

  const parsed = parseLocalizedTemperature(value);
  const recordedC = Number.isFinite(parsed) ? parsed : null;
  const result =
    recordedC === null
      ? null
      : classifyTemperatureResult({ recordedC, minTempC, maxTempC });

  const valueInputId = `${idPrefix}-recorded-c`;
  const correctiveActionId = `${idPrefix}-corrective-action`;

  return (
    <div className="space-y-4">
      {isMobile ? (
        <div className="relative flex items-center justify-center py-1">
          <div className="text-5xl leading-none font-semibold tabular-nums">
            {value === "" || value === "-" ? (
              <span className="text-muted-foreground/35">0</span>
            ) : (
              value
            )}
            <span className="ml-1.5 text-2xl font-normal text-muted-foreground">
              °C
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0"
            aria-label={t("keypad.backspace")}
            disabled={value.length === 0}
            onClick={() => onValueChange(value.slice(0, -1))}
          >
            <DeleteIcon />
          </Button>
        </div>
      ) : (
        <Field data-invalid={Boolean(valueError)}>
          <FieldLabel htmlFor={valueInputId}>
            {t("temperatureDialog.recordedCLabel")} (
            {t("temperatureDialog.celsius")})
          </FieldLabel>
          <Input
            id={valueInputId}
            value={value}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(valueError)}
            aria-describedby={`${idPrefix}-result`}
            className="h-14 text-center text-3xl font-semibold tabular-nums"
            placeholder={t("temperatureDialog.recordedCPlaceholder")}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={onValueBlur}
          />
        </Field>
      )}

      <TemperatureRangeMeter
        value={recordedC}
        minTempC={minTempC}
        maxTempC={maxTempC}
      />

      <div
        id={`${idPrefix}-result`}
        aria-live="polite"
        className="flex min-h-6 flex-wrap items-center justify-center gap-2"
      >
        {result ? (
          <>
            <Badge variant={result === "ok" ? "success" : "destructive"}>
              {result === "ok" ? <CheckIcon /> : <CircleAlertIcon />}
              {result === "ok"
                ? t("temperatureDialog.ok")
                : t("temperatureDialog.outOfRange")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {result === "ok"
                ? t("temperatureDialog.okHint")
                : t("temperatureDialog.outOfRangeHint")}
            </span>
          </>
        ) : null}
      </div>

      {/* Sits above the keypad: once a reading is flagged, describing the fix
          is the next required step, and the keypad is a tall thing to scroll past. */}
      {result === "out_of_range" ? (
        <Field data-invalid={Boolean(correctiveActionError)}>
          <FieldLabel htmlFor={correctiveActionId}>
            {t("temperatureDialog.correctiveActionLabel")}
          </FieldLabel>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_KEYS.map((key) => {
              const label = t(`temperatureDialog.presets.${key}`);
              const active = hasCorrectiveActionPreset(correctiveAction, label);

              return (
                <Button
                  key={key}
                  variant={active ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={active}
                  className={cn(
                    "h-8 rounded-full",
                    active && "ring-1 ring-primary/40",
                  )}
                  onClick={() =>
                    onCorrectiveActionChange(
                      toggleCorrectiveActionPreset(correctiveAction, label),
                    )
                  }
                >
                  {active ? <CheckIcon /> : null}
                  {label}
                </Button>
              );
            })}
          </div>

          <Textarea
            id={correctiveActionId}
            value={correctiveAction}
            aria-invalid={Boolean(correctiveActionError)}
            placeholder={t("temperatureDialog.correctiveActionPlaceholder")}
            className="min-h-20 resize-y"
            onChange={(event) => onCorrectiveActionChange(event.target.value)}
            onBlur={onCorrectiveActionBlur}
          />
          <p className="text-xs text-muted-foreground">
            {t("temperatureDialog.correctiveActionHint")}
          </p>
          {correctiveActionError ? (
            <FieldError errors={[{ message: correctiveActionError }]} />
          ) : null}
        </Field>
      ) : null}

      {isMobile ? (
        <NumericKeypad
          value={value}
          onValueChange={onValueChange}
          separator={separator}
        />
      ) : null}

      {valueError ? (
        <p className="text-center text-sm text-destructive">{valueError}</p>
      ) : null}
    </div>
  );
}
