"use client";

import { CheckIcon, ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { occurrenceKey } from "../lib/today-grouping";
import type { TodayTimeGroup, TodayTimelineItem } from "../lib/today-timeline";
import { TodayTaskRow } from "./today-task-row";

type Props = {
  group: TodayTimeGroup;
  isLast: boolean;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

function useDurationLabel() {
  const t = useTranslations("TodayPage");

  return (minutes: number, direction: "until" | "late") => {
    const total = Math.max(0, Math.round(Math.abs(minutes)));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    const prefix = direction === "until" ? "relative.in" : "relative.lateBy";

    if (hours === 0) return t(`${prefix}Minutes`, { count: rest });
    if (rest === 0) return t(`${prefix}Hours`, { count: hours });
    return t(`${prefix}HoursMinutes`, { hours, minutes: rest });
  };
}

export function TodayTimeGroup({
  group,
  isLast,
  syncingKeys,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const durationLabel = useDurationLabel();

  // A finished group folds away, unless it hides a deviation worth seeing.
  const [open, setOpen] = useState(
    group.state !== "done" || group.deviationCount > 0,
  );

  const headingId = `${group.id}-heading`;

  const summaryText = (() => {
    switch (group.state) {
      case "now":
      case "overdue":
        return t("timeline.remaining", { count: group.remainingCount });
      case "done":
        return t("timeline.doneCount", { count: group.total });
      case "upcoming":
        return `${durationLabel(group.minutesUntil, "until")} · ${group.total}`;
    }
  })();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        id={group.id}
        aria-labelledby={headingId}
        className="relative scroll-mt-28 pb-2 pl-9 sm:pl-11"
      >
        {/* Rail segment — consecutive groups join into one continuous line. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-0 bottom-0 left-[13px] -translate-x-1/2 sm:left-[15px]",
            group.state === "now"
              ? "w-0.5 bg-primary/70"
              : group.state === "overdue"
                ? "w-px bg-destructive/35"
                : "w-px bg-border",
            isLast && "bg-gradient-to-b from-border to-transparent",
          )}
        />

        {/* Marker */}
        <span
          aria-hidden
          className="absolute top-[15px] left-[13px] flex size-3.5 -translate-x-1/2 items-center justify-center sm:left-[15px]"
        >
          {group.state === "now" ? (
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
          ) : null}
          <span
            className={cn(
              "relative size-3.5 rounded-full ring-4 ring-background",
              group.state === "now" && "bg-primary",
              group.state === "overdue" && "bg-destructive",
              group.state === "done" &&
                (group.deviationCount > 0 ? "bg-destructive" : "bg-success"),
              group.state === "upcoming" && "border-2 border-border bg-card",
            )}
          />
        </span>

        <CollapsibleTrigger
          aria-label={`${group.scheduledTime}, ${summaryText}`}
          className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md py-2 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <time
            dateTime={group.scheduledTime}
            id={headingId}
            className={cn(
              "text-[15px] leading-none font-semibold tabular-nums",
              group.state === "now" && "text-primary",
              group.state === "overdue" && "text-destructive",
              group.state === "done" && "text-muted-foreground",
            )}
          >
            {group.scheduledTime}
          </time>

          {group.state === "now" ? (
            <Badge className="uppercase">{t("timeline.now")}</Badge>
          ) : null}
          {group.state === "overdue" ? (
            <Badge variant="destructive">
              <CircleAlertIcon />
              {t("timeline.overdue")}
            </Badge>
          ) : null}
          {group.state === "done" && group.deviationCount === 0 ? (
            <CheckIcon className="size-4 text-success" aria-hidden />
          ) : null}
          {group.deviationCount > 0 ? (
            <Badge variant="destructive">
              <CircleAlertIcon />
              {t("timeline.deviations", { count: group.deviationCount })}
            </Badge>
          ) : null}

          {/* The deviation badge already states the headline for a finished
              group, so the count would only crowd it out on narrow screens. */}
          {group.state === "done" && group.deviationCount > 0 ? null : (
            <span className="truncate text-[13px] text-muted-foreground">
              {summaryText}
            </span>
          )}

          <ChevronDownIcon
            className="ml-auto size-4 shrink-0 text-muted-foreground/60 transition-transform group-data-panel-open:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ul className="space-y-2 pt-0.5 pb-1">
            {group.items.map((item) => (
              <li key={occurrenceKey(item.task)}>
                <TodayTaskRow
                  item={item}
                  groupState={group.state}
                  isSyncing={syncingKeys.has(occurrenceKey(item.task))}
                  currentUserId={currentUserId}
                  onActivate={onActivate}
                />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
