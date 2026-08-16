"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";
import type { TemperatureVerdict } from "../lib/temperature";

type Props = {
  id?: string;
  verdict: TemperatureVerdict | null;
  value: number | null;
  minTempC: number;
  maxTempC: number;
  error?: string | null;
  className?: string;
};

/** Fixed height so growth cannot push the commit bar under the keyboard. One live region for the settled verdict. */
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
