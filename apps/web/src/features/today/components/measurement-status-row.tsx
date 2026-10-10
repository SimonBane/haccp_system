"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { MeasurementVerdict } from "@/features/forms/lib/measurement";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  verdict: MeasurementVerdict | null;
  /** The settled reading with its unit, for the screen-reader verdict. */
  valueText: string | null;
  limitsText: string | null;
  error?: string | null;
  className?: string;
};

/** Fixed height so growth cannot push the commit bar under the keyboard. One live region for the settled verdict. */
export function MeasurementStatusRow({
  id,
  verdict,
  valueText,
  limitsText,
  error,
  className,
}: Props) {
  const t = useTranslations("TodayPage.recordDialog");

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
        limitsText ? (
          <span className="truncate text-xs text-muted-foreground">
            {t("allowed", { limits: limitsText })}
          </span>
        ) : null
      ) : (
        <>
          <Badge variant={verdict === "pass" ? "success" : "destructive"}>
            {verdict === "pass" ? <CheckIcon /> : <CircleAlertIcon />}
            {verdict === "pass" ? t("withinLimits") : t("outsideLimits")}
          </Badge>

          {limitsText ? (
            <span className="truncate text-xs text-muted-foreground">
              {limitsText}
            </span>
          ) : null}

          {valueText ? (
            <span className="sr-only">
              {verdict === "pass"
                ? t("srWithinLimits", { value: valueText })
                : t("srOutsideLimits", { value: valueText })}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
