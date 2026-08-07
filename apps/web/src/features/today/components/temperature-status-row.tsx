"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";
import {
  temperaturePlausibility,
  type TemperatureVerdict,
} from "../lib/temperature";

type Props = {
  id?: string;
  /** Settled verdict — null while nothing has been entered yet. */
  verdict: TemperatureVerdict | null;
  /** The value the verdict was judged on, so the two can never disagree. */
  value: number | null;
  minTempC: number;
  maxTempC: number;
  className?: string;
};

/**
 * Fixed height in every state, because this row sits between the reading and the
 * keypad: anything that grows here pushes the keys off a phone screen.
 *
 * It is also the one live region on the screen. It speaks the settled verdict as
 * a whole sentence, so a screen reader hears one utterance per finished reading
 * rather than one per digit.
 */
export function TemperatureStatusRow({
  id,
  verdict,
  value,
  minTempC,
  maxTempC,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const implausible =
    value !== null && temperaturePlausibility(value) !== "ok";

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
      {verdict === null ? (
        <span className="text-xs text-muted-foreground">
          {t("temperatureDialog.statusIdle", {
            min: formatTemperature(minTempC, locale),
            max: formatTemperature(maxTempC, locale),
          })}
        </span>
      ) : (
        <>
          <Badge variant={verdict === "ok" ? "success" : "destructive"}>
            {verdict === "ok" ? <CheckIcon /> : <CircleAlertIcon />}
            {verdict === "ok"
              ? t("temperatureDialog.ok")
              : t("temperatureDialog.outOfRange")}
          </Badge>
          <span
            className={cn(
              "truncate text-xs",
              implausible ? "text-warning" : "text-muted-foreground",
            )}
          >
            {implausible
              ? t("temperatureDialog.implausibleHint")
              : verdict === "ok"
                ? t("temperatureDialog.okHint")
                : t("temperatureDialog.outOfRangeHint")}
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
