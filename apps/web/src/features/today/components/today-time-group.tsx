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
import type {
  TimeGroupState,
  TodayTimeGroup,
  TodayTimelineItem,
} from "../lib/today-timeline";
import { TodayTaskRow } from "./today-task-row";

type Props = {
  group: TodayTimeGroup;
  /** The group immediately above this one, so the rail leading up to this
   * dot can carry its state instead of this group's own. */
  previousGroup: TodayTimeGroup | null;
  /** True for the group the live now-line sits directly above: the rail
   * leading down to it is future, not a continuation of whatever came before
   * the now-line, so it stays dashed regardless of the previous group's state. */
  isAfterNowLine: boolean;
  isLast: boolean;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

// A bit heavier than Tailwind's default 1px dashed border, whose dashes all
// but disappear against the muted border color — still clearly a hint of
// what's ahead, not a full rail.
const UPCOMING_RAIL_CLASSNAME =
  "w-0 border-l-2 border-dashed border-muted-foreground/30";

/**
 * Dashes are keyed off "upcoming" rather than a past/future flag: a round
 * completed early is still solid green, because completion is the stronger
 * signal than where the clock happens to be.
 *
 * Done and overdue match the "now" rail's width so the whole rail reads at a
 * glance — only "upcoming" stays a thin dashed hint of what's ahead.
 */
function getRailClassName(state: TimeGroupState, deviationCount: number): string {
  switch (state) {
    case "now":
      return "w-0.5 bg-primary/70";
    case "overdue":
      return "w-0.5 bg-destructive/40";
    case "done":
      return deviationCount > 0
        ? "w-0.5 bg-destructive/40"
        : "w-0.5 bg-success/40";
    case "upcoming":
      return UPCOMING_RAIL_CLASSNAME;
  }
}

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
  previousGroup,
  isAfterNowLine,
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
  const railClassName = getRailClassName(group.state, group.deviationCount);
  const incomingRailClassName = previousGroup
    ? isAfterNowLine
      ? UPCOMING_RAIL_CLASSNAME
      : getRailClassName(previousGroup.state, previousGroup.deviationCount)
    : null;

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
        {/* Rail, split at the dot's own centre (22px — the marker starts at
            15px and is 14px tall) so a colour never starts before its dot: the
            segment above carries the state of the round that just ended, the
            segment below carries this one's. Together they still read as one
            continuous line, colour reporting how the day went at a glance. */}
        {incomingRailClassName ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-0 left-[13px] h-[22px] -translate-x-1/2 sm:left-[15px]",
              incomingRailClassName,
            )}
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "absolute top-[22px] bottom-0 left-[13px] -translate-x-1/2 sm:left-[15px]",
            railClassName,
            // Fades whatever the segment is — colour or dashes — rather than
            // replacing its background, so the last round still reads as itself.
            isLast &&
              "[mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]",
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

          {/* A deviation badge alongside a state badge already fills a 375px
              header, and the count is the least important of the three — it
              stays in the trigger's aria-label either way. */}
          {group.state === "done" && group.deviationCount > 0 ? null : (
            <span
              className={cn(
                "truncate text-[13px] text-muted-foreground",
                group.deviationCount > 0 && "hidden sm:inline",
              )}
            >
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
