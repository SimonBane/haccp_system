"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";

type Props = {
  /** Live value — the needle tracks every keystroke. */
  value: number | null;
  minTempC: number;
  maxTempC: number;
  /** Settled verdict — colour only, so a half-typed number never turns red. */
  state: "neutral" | "ok" | "out_of_range";
  className?: string;
};

/** Below this the two edge labels overlap, so they collapse into one. */
const COMBINED_LABEL_THRESHOLD = 18;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Where the reading falls against the allowed band, readable without comparing
 * numbers. The track is neutral rather than red: nothing is wrong until the
 * needle says so, and a red-by-default scale reads as an alarm on an empty form.
 */
export function TemperatureGauge({
  value,
  minTempC,
  maxTempC,
  state,
  className,
}: Props) {
  const locale = useLocale();

  const span = Math.max(maxTempC - minTempC, 0.1);
  const padding = Math.max(span * 0.75, 3);
  const baseMin = minTempC - padding;
  const baseMax = maxTempC + padding;
  const domainMin = value === null ? baseMin : Math.min(baseMin, value);
  const domainMax = value === null ? baseMax : Math.max(baseMax, value);
  const domainSpan = domainMax - domainMin || 1;

  const percentOf = (temperature: number) =>
    clamp(((temperature - domainMin) / domainSpan) * 100, 0, 100);

  const bandStart = percentOf(minTempC);
  const bandEnd = percentOf(maxTempC);
  const combineLabels = bandEnd - bandStart < COMBINED_LABEL_THRESHOLD;

  const minLabel = formatTemperature(minTempC, locale);
  const maxLabel = formatTemperature(maxTempC, locale);

  return (
    // Decorative: the status row states the same thing in words, and a needle
    // that moves on every keystroke would flood a screen reader.
    <div aria-hidden className={cn("select-none", className)}>
      <div className="relative h-2 w-full rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-success/30"
          style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
        />
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-success/60"
          style={{ left: `${bandStart}%` }}
        />
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-success/60"
          style={{ left: `${bandEnd}%` }}
        />

        {value !== null ? (
          <span
            className={cn(
              "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background",
              "transition-[left,background-color] duration-150 motion-reduce:transition-none",
              state === "out_of_range" && "bg-destructive",
              state === "ok" && "bg-success",
              state === "neutral" && "bg-foreground/60",
            )}
            // Kept off the very edge so the dot is never half-clipped.
            style={{ left: `${clamp(percentOf(value), 2, 98)}%` }}
          />
        ) : null}
      </div>

      <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-muted-foreground">
        {combineLabels ? (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(bandStart + bandEnd) / 2}%` }}
          >
            {minLabel} … {maxLabel}
          </span>
        ) : (
          <>
            <span
              className="absolute -translate-x-1/2"
              style={{ left: `${bandStart}%` }}
            >
              {minLabel}
            </span>
            <span
              className="absolute -translate-x-1/2"
              style={{ left: `${bandEnd}%` }}
            >
              {maxLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
