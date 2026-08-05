"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";

type Props = {
  /** Null while the field is empty or unparseable. */
  value: number | null;
  minTempC: number;
  maxTempC: number;
};

/**
 * Shows where a reading falls against the allowed band. Pass or fail is read at
 * a glance, without comparing numbers — which matters when the person holding
 * the phone is standing in a cold room.
 */
export function TemperatureRangeMeter({ value, minTempC, maxTempC }: Props) {
  const locale = useLocale();

  const span = Math.max(maxTempC - minTempC, 1);
  const padding = Math.max(span * 0.6, 2);
  const domainMin = Math.min(minTempC - padding, value ?? Number.POSITIVE_INFINITY);
  const domainMax = Math.max(maxTempC + padding, value ?? Number.NEGATIVE_INFINITY);
  const domainSpan = domainMax - domainMin || 1;

  const percentOf = (temperature: number) =>
    ((temperature - domainMin) / domainSpan) * 100;

  const isInRange =
    value !== null && value >= minTempC && value <= maxTempC;

  return (
    <div aria-hidden>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-destructive/15">
        <div
          className="absolute inset-y-0 bg-success/35"
          style={{
            left: `${percentOf(minTempC)}%`,
            right: `${100 - percentOf(maxTempC)}%`,
          }}
        />
      </div>

      <div className="relative h-0">
        {value !== null ? (
          <span
            className={cn(
              "absolute top-[-14px] size-4 -translate-x-1/2 rounded-full ring-[3px] ring-background transition-all",
              isInRange ? "bg-success" : "bg-destructive",
            )}
            // Kept off the very edge so the dot is never half-clipped.
            style={{
              left: `${Math.min(Math.max(percentOf(value), 2), 98)}%`,
            }}
          />
        ) : null}
      </div>

      <div className="relative mt-2 h-4 text-[11px] tabular-nums text-muted-foreground">
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${percentOf(minTempC)}%` }}
        >
          {formatTemperature(minTempC, locale)}
        </span>
        <span
          className="absolute -translate-x-1/2"
          style={{ left: `${percentOf(maxTempC)}%` }}
        >
          {formatTemperature(maxTempC, locale)}
        </span>
      </div>
    </div>
  );
}
