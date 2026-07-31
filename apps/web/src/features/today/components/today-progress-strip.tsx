"use client";

import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

type Props = {
  completed: number;
  total: number;
};

export function TodayProgressStrip({ completed, total }: Props) {
  const t = useTranslations("TodayPage");
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressSummary = t("progress.summary", { completed, total });

  return (
    <section
      className="xl:hidden"
      aria-label={t("summary.ariaLabel")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {t("progress.label")}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {completed}/{total}
          <span className="text-muted-foreground font-normal">
            {" "}
            ({progressValue}%)
          </span>
        </span>
      </div>
      <Progress
        value={progressValue}
        aria-label={t("progress.label")}
        aria-valuetext={progressSummary}
        className="mt-2"
      />
    </section>
  );
}
