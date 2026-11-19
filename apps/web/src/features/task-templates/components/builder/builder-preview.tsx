"use client";

import type { FormListItem } from "@haccp/shared";
import { ClipboardCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import {
  DayStrip,
  HOUR_MARKS,
  HourRuler,
} from "@/features/task-templates/components/day-timeline";
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import { summarizeTargetNames } from "@/features/task-templates/lib/format-targets";
import { opensAt } from "@/features/task-templates/lib/schedule";
import type { MissingStep, TaskDraft } from "@/features/task-templates/lib/task-draft";
import { draftWindow } from "@/features/task-templates/lib/task-draft";
import { EMPTY_VALUE } from "@/lib/empty-value";
import { cn } from "@/lib/utils";

const CARD = "flex flex-col gap-3 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10";

type BuilderPreviewProps = {
  draft: TaskDraft;
  form: FormListItem | null;
  times: string[];
  targetNames: string[];
  itemsText: string;
  checksPerDay: number;
  missing: MissingStep[];
  showErrors: boolean;
};

/** Live summary beside the desktop form: what was chosen, the day on a 24 h strip and the row staff will see. */
export function BuilderPreview({
  draft,
  form,
  times,
  targetNames,
  itemsText,
  checksPerDay,
  missing,
  showErrors,
}: BuilderPreviewProps) {
  const t = useTranslations("TasksPage.builder.preview");
  const labels = useScheduleLabels();
  const window = draftWindow(draft);
  const Icon = form ? FORM_CATEGORY_ICONS[form.category] : ClipboardCheckIcon;
  const title = draft.title.trim() || form?.name || "";
  const first = times[0];

  return (
    <aside aria-label={t("label")} className="flex flex-col gap-4 lg:sticky lg:top-24">
      <div className={CARD}>
        <span className="text-xs font-semibold text-muted-foreground">{t("summary")}</span>
        {form ? (
          <>
            <p className="truncate text-base font-semibold" title={title}>
              {title}
            </p>
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px] [&_dd]:break-words">
              <dt className="text-muted-foreground">{t("form")}</dt>
              <dd>{form.name}</dd>
              <dt className="text-muted-foreground">{t("checks")}</dt>
              <dd>
                {summarizeTargetNames(targetNames, (count) => t("more", { count })) ?? EMPTY_VALUE}
              </dd>
              <dt className="text-muted-foreground">{t("days")}</dt>
              <dd>{draft.weekdays.length ? labels.days(draft.weekdays) : EMPTY_VALUE}</dd>
              <dt className="text-muted-foreground">{t("times")}</dt>
              <dd className="tabular-nums">{times.length ? labels.times(times, 5) : EMPTY_VALUE}</dd>
              <dt className="text-muted-foreground">{t("window")}</dt>
              <dd>{labels.window(window)}</dd>
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("start")}</p>
        )}
        <p className="border-t pt-3 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {checksPerDay} {t("perDay", { count: checksPerDay })}
          </span>
          {checksPerDay ? ` · ${t("perDayDetail", { times: times.length, items: itemsText })}` : ""}
        </p>
      </div>

      <div className={CARD}>
        <span className="text-xs font-semibold text-muted-foreground">
          {t("glanceTitle")}
        </span>
        <DayStrip
          times={times}
          window={window}
          gridHours={HOUR_MARKS.compact}
          className="mt-1 h-9"
          label={
            times.length
              ? t("glanceLabel", { count: times.length, from: times[0]!, until: times.at(-1)! })
              : t("glanceEmptyLabel")
          }
        />
        <HourRuler hours={HOUR_MARKS.compact} />
        <p className="text-xs text-muted-foreground">
          {!times.length ? t("glanceNoTimes") : window ? t("glanceWindow") : t("glanceNoWindow")}
        </p>
      </div>

      <div className={CARD}>
        <span className="text-xs font-semibold text-muted-foreground">{t("today")}</span>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
            <Icon className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{title || EMPTY_VALUE}</span>
            <span className="truncate text-xs text-muted-foreground">
              {[
                targetNames[0] ?? itemsText,
                first ?? "--:--",
                window && first ? t("opensAt", { time: opensAt(first, window.opensBefore) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {checksPerDay ? t("todayRows", { count: checksPerDay }) : t("todayRowsNone")}{" "}
          {window && window.dueAfter !== null ? t("overdueNote") : t("neverOverdue")}
        </p>
      </div>

      {missing.length > 0 && (form || showErrors) ? (
        <div
          className={cn(
            "flex flex-col gap-1.5 rounded-xl px-4 py-3.5",
            showErrors ? "bg-destructive/10 text-destructive" : "bg-muted",
          )}
        >
          <span className="text-[13px] font-semibold">{t("stillNeeded")}</span>
          <ul className="flex list-disc flex-col gap-1 pl-4.5 text-[13px]">
            {missing.map((step) => (
              <li key={step}>{t(`missing.${step}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
