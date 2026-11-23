"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FALLBACK_FORM_ICON,
  FORM_CATEGORY_ICONS,
} from "@/features/forms/lib/category-icon";
import { cn } from "@/lib/utils";
import { useTodayLabels } from "../hooks/use-today-labels";
import type { TodayDay, TodayEntry, TodayGroup } from "../lib/today-day";
import { ROW_BUTTON_CLASS, StatusTile, type TileTone } from "./status-tile";

type Props = {
  day: TodayDay;
  /** The row whose check is open beside the list. */
  selectedKey: string | null;
  currentUserId: string;
  timeZone: string;
  onOpenGroup: (group: TodayGroup) => void;
  onOpenEntry: (entry: TodayEntry) => void;
};

type RowProps = {
  rowKey: string;
  icon: LucideIcon;
  tone: TileTone;
  title: string;
  meta: string;
  metaAlert?: boolean;
  isLate?: boolean;
  when?: string;
  selected: boolean;
  disabled?: boolean;
  onOpen: () => void;
};

function Row({
  rowKey,
  icon,
  tone,
  title,
  meta,
  metaAlert = false,
  isLate = false,
  when = "",
  selected,
  disabled = false,
  onOpen,
}: RowProps) {
  const t = useTranslations("TodayPage.row");

  return (
    <li>
      <Button
        variant="ghost"
        disabled={disabled}
        aria-current={selected ? "true" : undefined}
        className={cn(
          ROW_BUTTON_CLASS,
          "min-h-15 disabled:opacity-100",
          selected && "bg-primary/10 hover:bg-primary/10 dark:bg-primary/20",
        )}
        onClick={onOpen}
        data-testid="today-task-row"
        data-row-key={rowKey}
      >
        <StatusTile icon={icon} tone={tone} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{title}</span>
          <span
            className={cn(
              "text-xs tabular-nums",
              metaAlert ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        </span>
        {isLate ? <Badge variant="destructive">{t("late")}</Badge> : null}
        <span className="flex shrink-0 items-center gap-1">
          {when ? (
            <span
              className={cn(
                "text-[13px] tabular-nums",
                isLate ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {when}
            </span>
          ) : null}
          {/* Kept, hidden, on a locked row so its time lines up with the rest. */}
          <ChevronRightIcon
            aria-hidden
            className={cn("text-muted-foreground", disabled && "invisible")}
          />
        </span>
      </Button>
    </li>
  );
}

function Section({
  title,
  info,
  variant,
  children,
}: {
  title: string;
  info: string;
  variant: "todo" | "later" | "done";
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-xs ring-1",
        variant === "todo"
          ? "ring-[1.5px] ring-primary/50"
          : "ring-foreground/10",
      )}
      data-testid={`today-section-${variant}`}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
        <h2 className="flex">
          <Badge
            variant={
              variant === "todo"
                ? "default"
                : variant === "done"
                  ? "success"
                  : "secondary"
            }
            className="h-[22px] px-2.5 font-semibold"
          >
            {title}
          </Badge>
        </h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {info}
        </span>
      </div>
      <ul className="divide-y border-t">{children}</ul>
    </section>
  );
}

/** Now, Later and Done as three cards; a late check is flagged where it already sits. */
export function TodaySections({
  day,
  selectedKey,
  currentUserId,
  timeZone,
  onOpenGroup,
  onOpenEntry,
}: Props) {
  const t = useTranslations("TodayPage");
  const labels = useTodayLabels(currentUserId, timeZone);

  function openMeta(group: TodayGroup): string {
    return group.isLocked && group.window?.opensAt && day.isToday
      ? t("row.opensAt", { time: group.window.opensAt })
      : labels.progress(group);
  }

  function groupRow(group: TodayGroup, tone: TileTone) {
    const CategoryIcon = group.form
      ? FORM_CATEGORY_ICONS[group.form.category]
      : FALLBACK_FORM_ICON;

    if (group.isComplete) {
      const done = labels.completion(group.completedAt, group.completedBy);
      return (
        <Row
          key={group.key}
          rowKey={group.key}
          icon={group.hasDeviation ? CircleAlertIcon : CheckIcon}
          tone={group.hasDeviation ? "destructive" : "success"}
          title={group.title}
          meta={
            group.hasDeviation
              ? [done, t("row.needsAttention")].filter(Boolean).join(" · ")
              : done
          }
          metaAlert={group.hasDeviation}
          when={labels.when(group.window, group.scheduledTime)}
          selected={selectedKey === group.key}
          onOpen={() => onOpenGroup(group)}
        />
      );
    }

    return (
      <Row
        key={group.key}
        rowKey={group.key}
        icon={CategoryIcon}
        tone={group.isLate ? "destructive" : tone}
        title={group.title}
        meta={openMeta(group)}
        isLate={group.isLate}
        when={labels.when(group.window, group.scheduledTime)}
        selected={selectedKey === group.key}
        disabled={group.isLocked}
        onOpen={() => onOpenGroup(group)}
      />
    );
  }

  const doneCount = day.done.length + day.entries.length;
  const deviations =
    day.deviationCount +
    day.entries.filter((entry) => entry.isDeviation).length;

  return (
    <div className="flex flex-col gap-5">
      {day.todo.length > 0 ? (
        <Section
          variant="todo"
          title={t("sections.todo")}
          info={t("sections.count", { count: day.todo.length })}
        >
          {day.todo.map((group) => groupRow(group, "primary"))}
        </Section>
      ) : null}

      {day.later.length > 0 ? (
        <Section
          variant="later"
          title={day.isFuture ? t("sections.planned") : t("sections.later")}
          info={t("sections.count", { count: day.later.length })}
        >
          {day.later.map((group) => groupRow(group, "muted"))}
        </Section>
      ) : null}

      {doneCount > 0 ? (
        <Section
          variant="done"
          title={t("sections.done")}
          info={
            deviations > 0
              ? t("sections.doneWithDeviations", {
                  count: doneCount,
                  deviations,
                })
              : t("sections.count", { count: doneCount })
          }
        >
          {day.done.map((group) => groupRow(group, "success"))}
          {day.entries.map((entry) => {
            const done = [
              labels.completion(entry.task.completedAt, entry.task.completedBy),
              entry.task.targetName,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Row
                key={entry.key}
                rowKey={entry.key}
                icon={entry.isDeviation ? CircleAlertIcon : CheckIcon}
                tone={entry.isDeviation ? "destructive" : "success"}
                title={entry.task.title}
                meta={
                  entry.isDeviation
                    ? `${done} · ${t("row.needsAttention")}`
                    : done
                }
                metaAlert={entry.isDeviation}
                selected={selectedKey === entry.key}
                onOpen={() => onOpenEntry(entry)}
              />
            );
          })}
        </Section>
      ) : null}
    </div>
  );
}
