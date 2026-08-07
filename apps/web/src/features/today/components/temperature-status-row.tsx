"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";
import type { TemperatureVerdict } from "../lib/temperature";

type Props = {
  id?: string;
  /** Settled verdict — null while nothing complete has been entered yet. */
  verdict: TemperatureVerdict | null;
  /** The value the verdict was judged on, so the two can never disagree. */
  value: number | null;
  minTempC: number;
  maxTempC: number;
  error?: string | null;
  className?: string;
};

/**
 * Fixed height in every state, because this row sits between the reading and the
 * keypad: anything that grows here pushes the keys off a phone screen.
 *
 * It keeps showing the allowed range after a verdict arrives. The range used to
 * be replaced by the words "within the allowed range", which is what the badge
 * beside it already says — so the worker lost the numbers they were comparing
 * against at exactly the moment they wanted to check them.
 *
 * It is also the one live region on the screen, and the only place the field
 * error appears. It speaks the settled verdict as a whole sentence, so a screen
 * reader hears one utterance per finished reading rather than one per digit,
 * and because it renders an error *or* a verdict and is atomic, there is exactly
 * one utterance either way.
 */
export function TemperatureStatusRow({
  id,
  verdict,
  value,
  minTempC,
  maxTempC,
  error,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const min = formatTemperature(minTempC, locale);
  const max = formatTemperature(maxTempC, locale);

  return (
    <div
      id={id}
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex h-9 items-center justify-center gap-2 text-center",
        className,
      )}
    >
      {error ? (
        <span className="truncate text-sm text-destructive">{error}</span>
      ) : verdict === null ? (
        <span className="truncate text-xs text-muted-foreground">
          {t("temperatureDialog.rangeIdle", { min, max })}
        </span>
      ) : (
        <>
          <Badge variant={verdict === "ok" ? "success" : "destructive"}>
            {verdict === "ok" ? <CheckIcon /> : <CircleAlertIcon />}
            {verdict === "ok"
              ? t("temperatureDialog.ok")
              : t("temperatureDialog.outOfRange")}
          </Badge>

          <span className="truncate text-xs text-muted-foreground">
            {t("temperatureDialog.rangeInline", { min, max })}
          </span>

          {/* The visible badge is an icon plus two words; this is the sentence
              a screen reader should actually hear. */}
          <span className="sr-only">
            {value === null
              ? null
              : verdict === "ok"
                ? t("temperatureDialog.srVerdictOk", {
                    value: formatTemperature(value, locale),
                  })
                : t("temperatureDialog.srVerdictOutOfRange", {
                    value: formatTemperature(value, locale),
                  })}
          </span>
        </>
      )}
    </div>
  );
}
