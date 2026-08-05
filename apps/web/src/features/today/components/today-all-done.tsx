"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  deviationCount: number;
};

export function TodayAllDone({ total, deviationCount }: Props) {
  const t = useTranslations("TodayPage");
  const hasDeviations = deviationCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl px-5 py-6 text-center ring-1",
        hasDeviations
          ? "bg-warning/[0.06] ring-warning/20"
          : "bg-success/[0.06] ring-success/20",
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          hasDeviations
            ? "bg-warning/12 text-warning"
            : "bg-success/12 text-success",
        )}
        aria-hidden
      >
        {hasDeviations ? (
          <CircleAlertIcon className="size-6" />
        ) : (
          <CheckIcon className="size-6" strokeWidth={2.5} />
        )}
      </span>
      <h2 className="font-heading text-lg font-medium">{t("allDone.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {hasDeviations
          ? t("allDone.withDeviations", { count: deviationCount })
          : t("allDone.description", { count: total })}
      </p>
    </div>
  );
}
