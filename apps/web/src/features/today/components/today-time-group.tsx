"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ThermometerIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { chainableTemperatureItems } from "../lib/today-round";
import { occurrenceKey } from "../lib/today-grouping";
import type {
  TimeGroupState,
  TodayTimeGroup,
  TodayTimelineItem,
} from "../lib/today-timeline";
import {
  RAIL_DOT_CLASSNAME,
  RAIL_SEGMENT_CLASSNAME,
  RAIL_TAIL_SEGMENT_CLASSNAME,
  UPCOMING_RAIL_CLASSNAME,
} from "./today-rail";
import { TodayTaskRow } from "./today-task-row";

type Props = {
  group: TodayTimeGroup;
  /** Last completed round before the live now marker — stays expanded. */
  isLastBeforeNowLine: boolean;
  /** Last block on the axis, so its rail fades out instead of reaching for a
   * dot below that does not exist. */
  isTail: boolean;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

/**
 * Dashes are keyed off "upcoming" rather than a past/future flag: a round
 * completed early is still solid green, because completion is the stronger
 * signal than where the clock happens to be.
 *
 * Done and overdue match the "now" rail's width so the whole rail reads at a
 * glance — only "upcoming" stays a thin dashed hint of what's ahead.
 */
function getRailClassName(
  state: TimeGroupState,
  deviationCount: number,
): string {
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

/**
 * The ring is the dot's own colour at a fraction of its strength, so the
 * marker reads as one object rather than a dot with a halo bolted on. Every
 * ring is 4px on a 14px dot — a 22px outer circle, the width the rail's
 * segments are cut to land on.
 */
function getDotRingClassName(
  state: TimeGroupState,
  deviationCount: number,
): string {
  switch (state) {
    case "now":
      return "ring-primary/20";
    case "overdue":
      return "ring-destructive/20";
    case "done":
      return deviationCount > 0 ? "ring-destructive/20" : "ring-success/20";
    case "upcoming":
      return "ring-muted-foreground/15";
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
  isLastBeforeNowLine,
  isTail,
  syncingKeys,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const durationLabel = useDurationLabel();

  // A finished group folds away, unless it hides a deviation worth seeing or
  // it is the anchor round directly above the live now marker.
  const [open, setOpen] = useState(
    group.state !== "done" || group.deviationCount > 0 || isLastBeforeNowLine,
  );

  const headingId = `${group.id}-heading`;
  const railClassName = getRailClassName(group.state, group.deviationCount);

  // Offered only when there is a round to run. A single pending check is what
  // tapping its row already does, so a button beside it would be noise.
  const roundItems = chainableTemperatureItems(group);
  const roundStart = roundItems.length >= 2 ? roundItems[0] : null;

  const summaryText = (() => {
    switch (group.state) {
      case "now":
      case "overdue":
        return t("timeline.remaining", { count: group.remainingCount });
      case "done":
        return t("timeline.doneCount", { count: group.total });
      case "upcoming":
        return durationLabel(group.minutesUntil, "until");
    }
  })();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        id={group.id}
        aria-labelledby={headingId}
        className="relative scroll-mt-28 pb-2 pl-9 sm:pl-11"
      >
        {/* Rail from this round's own dot down to the next one, carrying this
            round's state — a colour never starts before the dot that earned
            it, and the whole axis still reads as one line reporting how the
            day went at a glance. */}
        <span
          aria-hidden
          className={cn(
            isTail ? RAIL_TAIL_SEGMENT_CLASSNAME : RAIL_SEGMENT_CLASSNAME,
            railClassName,
          )}
        />

        {/* Marker */}
        <span
          aria-hidden
          className={cn(
            RAIL_DOT_CLASSNAME,
            "flex size-3.5 items-center justify-center",
          )}
        >
          {group.state === "now" ? (
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
          ) : null}
          <span
            className={cn(
              "relative size-3.5 rounded-full ring-4",
              getDotRingClassName(group.state, group.deviationCount),
              group.state === "now" && "bg-primary",
              group.state === "overdue" && "bg-destructive",
              group.state === "done" &&
                (group.deviationCount > 0 ? "bg-destructive" : "bg-success"),
              group.state === "upcoming" && "border-2 border-border bg-card",
            )}
          />
        </span>

        {/* Two targets, so they have to be siblings — a button nested inside
            the trigger would be invalid. The row's stretched-overlay trick
            works only where there is genuinely one thing to tap. */}
        <div className="flex items-center gap-2">
          <CollapsibleTrigger
            aria-label={`${group.scheduledTime}, ${summaryText}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
          </CollapsibleTrigger>

          {roundStart ? (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 shrink-0 gap-1.5 px-2.5 sm:min-h-8"
              aria-label={t("timeline.recordRound", {
                time: group.scheduledTime,
                count: roundItems.length,
              })}
              onClick={() => onActivate(roundStart)}
            >
              <ThermometerIcon className="size-3.5" />
              {t("actions.recordAll")}
            </Button>
          ) : null}

          <CollapsibleTrigger
            aria-label={`${group.scheduledTime}, ${summaryText}`}
            className="group flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon
              className="size-4 transition-transform group-data-panel-open:rotate-180"
              aria-hidden
            />
          </CollapsibleTrigger>
        </div>

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
