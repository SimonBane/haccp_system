"use client";

import type { MeasurementLimits, MeasurementUnit } from "@haccp/shared";
import { useLocale } from "next-intl";
import {
  formatMeasurementNumber,
  unitDecimals,
  type MeasurementVerdict,
} from "@/features/forms/lib/measurement";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null;
  limits: MeasurementLimits;
  unit: MeasurementUnit;
  symbol: string;
  /** Settled verdict — colour only, so a half-typed number never turns red. */
  state: MeasurementVerdict | "neutral";
  className?: string;
};

const COMBINED_LABEL_THRESHOLD = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Only rendered with at least one limit; a one-sided limit leaves the band open to that edge. */
export function MeasurementGauge({
  value,
  limits,
  unit,
  symbol,
  state,
  className,
}: Props) {
  const locale = useLocale();
  const { min, max } = limits;
  const anchor = min ?? max ?? 0;

  const minimumPadding = 10 ** -unitDecimals(unit) * 30;
  const span =
    min !== null && max !== null
      ? Math.max(max - min, minimumPadding / 30)
      : Math.max(Math.abs(anchor) * 0.25, minimumPadding);
  const padding = Math.max(span * 0.75, minimumPadding);
  const domainMin = (min ?? (max ?? anchor) - span) - padding;
  const domainMax = (max ?? (min ?? anchor) + span) + padding;
  const domainSpan = domainMax - domainMin || 1;

  const percentOf = (reading: number) =>
    clamp(((reading - domainMin) / domainSpan) * 100, 0, 100);

  const bandStart = min === null ? 0 : percentOf(min);
  const bandEnd = max === null ? 100 : percentOf(max);
  const combineLabels =
    min !== null &&
    max !== null &&
    bandEnd - bandStart < COMBINED_LABEL_THRESHOLD;

  const format = (reading: number) =>
    formatMeasurementNumber(reading, unit, locale);

  return (
    <div aria-hidden className={cn("select-none", className)}>
      <div className="relative h-2 w-full rounded-full bg-destructive/25">
        <div
          className="absolute inset-y-0 rounded-full bg-success/55"
          style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
        />
        {min !== null ? (
          <span
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-success"
            style={{ left: `${bandStart}%` }}
          />
        ) : null}
        {max !== null ? (
          <span
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-success"
            style={{ left: `${bandEnd}%` }}
          />
        ) : null}

        {value !== null ? (
          <span
            className={cn(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
              "transition-[left,background-color] duration-150 motion-reduce:transition-none",
              state === "fail" && "bg-destructive",
              state === "pass" && "bg-success",
              state === "neutral" && "bg-foreground/60",
            )}
            style={{ left: `${clamp(percentOf(value), 2, 98)}%` }}
          />
        ) : null}
      </div>

      <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-muted-foreground">
        {combineLabels && min !== null && max !== null ? (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(bandStart + bandEnd) / 2}%` }}
          >
            {format(min)} … {format(max)} {symbol}
          </span>
        ) : (
          <>
            {min !== null ? (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${bandStart}%` }}
              >
                {max === null ? `${format(min)} ${symbol}` : format(min)}
              </span>
            ) : null}
            {max !== null ? (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${bandEnd}%` }}
              >
                {format(max)} {symbol}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
