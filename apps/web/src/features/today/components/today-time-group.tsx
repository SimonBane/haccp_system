"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ThermometerIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";
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
  TodayTaskGroup,
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
  /** Clock-independent so its identity survives the minute tick. */
  group: TodayTaskGroup;
  state: TimeGroupState;
  timeZone: string;
  /** Null except for upcoming rounds, so the memo bails out between ticks. */
  minutesUntil: number | null;
  /** Last completed round before the now marker — stays expanded. */
  isLastBeforeNowLine: boolean;
  /** Last block on the axis: fade the rail instead of reaching for a missing dot. */
  isTail: boolean;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

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

/** 4px ring on a 14px dot = 22px outer circle, matching the rail segment cut. */
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

export const TodayTimeGroup = memo(function TodayTimeGroup({
  group,
  state,
  minutesUntil,
  timeZone,
  isLastBeforeNowLine,
  isTail,
  syncingKeys,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const durationLabel = useDurationLabel();

  // Fold done groups unless they hide a deviation or sit just above the now marker.
  const [open, setOpen] = useState(
    state !== "done" || group.deviationCount > 0 || isLastBeforeNowLine,
  );

  const headingId = `${group.id}-heading`;
  const railClassName = getRailClassName(state, group.deviationCount);

  const roundItems = chainableTemperatureItems(group);
  const roundStart = roundItems.length >= 2 ? roundItems[0] : null;

  const summaryText = (() => {
    switch (state) {
      case "now":
      case "overdue":
        return t("timeline.remaining", { count: group.remainingCount });
      case "done":
        return t("timeline.doneCount", { count: group.total });
      case "upcoming":
        return durationLabel(minutesUntil ?? 0, "until");
    }
  })();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        id={group.id}
        data-testid="today-time-group"
        data-scheduled-time={group.scheduledTime}
        aria-labelledby={headingId}
        className="relative scroll-mt-4 pb-2 pl-9 sm:pl-11 md:scroll-mt-16"
      >
        <span
          aria-hidden
          className={cn(
            isTail ? RAIL_TAIL_SEGMENT_CLASSNAME : RAIL_SEGMENT_CLASSNAME,
            railClassName,
          )}
        />

        <span
          aria-hidden
          className={cn(
            RAIL_DOT_CLASSNAME,
            "flex size-3.5 items-center justify-center",
          )}
        >
          {state === "now" ? (
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
          ) : null}
          <span
            className={cn(
              "relative size-3.5 rounded-full ring-4",
              getDotRingClassName(state, group.deviationCount),
              state === "now" && "bg-primary",
              state === "overdue" && "bg-destructive",
              state === "done" &&
                (group.deviationCount > 0 ? "bg-destructive" : "bg-success"),
              state === "upcoming" && "border-2 border-border bg-card",
            )}
          />
        </span>

        {/* Sibling targets — a button nested inside the trigger would be invalid HTML. */}
        <div className="flex items-center gap-2">
          <CollapsibleTrigger
            data-testid="today-time-group-toggle"
            aria-label={`${group.scheduledTime}, ${summaryText}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <time
              dateTime={group.scheduledTime}
              id={headingId}
              className={cn(
                "text-[15px] leading-none font-semibold tabular-nums",
                state === "now" && "text-primary",
                state === "overdue" && "text-destructive",
                state === "done" && "text-muted-foreground",
              )}
            >
              {group.scheduledTime}
            </time>

            {state === "now" ? (
              <Badge className="uppercase">{t("timeline.now")}</Badge>
            ) : null}
            {state === "overdue" ? (
              <Badge variant="destructive">
                <CircleAlertIcon />
                {t("timeline.overdue")}
              </Badge>
            ) : null}
            {state === "done" && group.deviationCount === 0 ? (
              <CheckIcon className="size-4 text-success" aria-hidden />
            ) : null}
            {group.deviationCount > 0 ? (
              <Badge variant="destructive">
                <CircleAlertIcon />
                {t("timeline.deviations", { count: group.deviationCount })}
              </Badge>
            ) : null}

            {state === "done" && group.deviationCount > 0 ? null : (
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
              data-testid="today-record-round"
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
                  groupState={state}
                  timeZone={timeZone}
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
});
