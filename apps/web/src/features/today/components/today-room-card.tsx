"use client";

import { TARGET_KIND } from "@haccp/shared";
import { CheckIcon, CircleAlertIcon, ListChecksIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { occurrenceKey } from "../lib/today-grouping";
import { isChainableItem, type RoundScope } from "../lib/today-round";
import { labelInRoom, type TodayRoomEntry } from "../lib/today-rooms";
import type { TodayTimelineItem } from "../lib/today-timeline";
import { TodayTaskRow } from "./today-task-row";

type Props = {
  room: TodayRoomEntry;
  timeZone: string;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem, scope?: RoundScope) => void;
};

const RoomIcon = TARGET_KIND_ICONS[TARGET_KIND.AREA];

/** One room's checks in a time slot, walked as one round. */
export const TodayRoomCard = memo(function TodayRoomCard({
  room,
  timeZone,
  syncingKeys,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const headingId = useId();

  const total = room.items.length;
  const doneCount = room.items.filter((item) => item.isCompleted).length;
  const deviationCount = room.items.filter((item) => item.isDeviation).length;
  const chainable = room.items.filter(isChainableItem);
  const roundStart = chainable.length >= 2 ? chainable[0] : null;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="today-room-card"
      className="rounded-2xl bg-muted/50 p-1.5 ring-1 ring-foreground/5"
    >
      <div className="flex min-h-11 items-center gap-2 px-2 py-1">
        <RoomIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={headingId} className="min-w-0 truncate text-sm font-semibold">
          {room.name}
        </h3>
        {deviationCount > 0 ? (
          <Badge variant="destructive">
            <CircleAlertIcon />
            {t("timeline.deviations", { count: deviationCount })}
          </Badge>
        ) : doneCount === total ? (
          <CheckIcon aria-hidden className="size-4 shrink-0 text-success" />
        ) : null}
        <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
          {t("room.progress", { done: doneCount, total })}
        </span>
        {roundStart ? (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto min-h-11 shrink-0 gap-1.5 px-2.5 sm:min-h-8"
            data-testid="today-record-room"
            aria-label={t("room.recordRoomLabel", {
              room: room.name,
              count: chainable.length,
            })}
            onClick={() => onActivate(roundStart, "item")}
          >
            <ListChecksIcon className="size-3.5" />
            {t("room.recordRoom")}
          </Button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {room.items.map((item) => (
          <li key={occurrenceKey(item.task)}>
            <TodayTaskRow
              item={item}
              timeZone={timeZone}
              isSyncing={syncingKeys.has(occurrenceKey(item.task))}
              currentUserId={currentUserId}
              onActivate={onActivate}
              targetLabel={
                item.task.targetKind === TARGET_KIND.AREA
                  ? t("room.wholeRoom")
                  : labelInRoom(item.task)
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
});
