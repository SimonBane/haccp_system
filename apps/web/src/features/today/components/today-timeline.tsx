"use client";

import { Fragment, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { scrollToTimeGroup } from "../lib/scroll";
import type { TodayTimeline as Timeline, TodayTimelineItem } from "../lib/today-timeline";
import { TodayNowLine } from "./today-now-line";
import {
  getRailLeadInClassName,
  RAIL_LEAD_IN_SPACING_CLASSNAME,
} from "./today-rail";
import { TodayTimeGroup } from "./today-time-group";

type Props = {
  timeline: Timeline;
  timeZone: string;
  scrollKey: string;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  disableActions: boolean;
  onActivate: (item: TodayTimelineItem) => void;
};

export function TodayTimeline({
  timeline,
  timeZone,
  scrollKey,
  syncingKeys,
  currentUserId,
  disableActions,
  onActivate,
}: Props) {
  const scrolledFor = useRef<string | null>(null);
  const { focusGroupId, groups } = timeline;

  useEffect(() => {
    if (scrolledFor.current === scrollKey) return;
    scrolledFor.current = scrollKey;

    if (!focusGroupId) return;
    // Skip when the live group is already first — scrolling would only hide the header.
    if (groups[0]?.id === focusGroupId) return;

    scrollToTimeGroup(focusGroupId);
  }, [scrollKey, focusGroupId, groups]);

  // Whichever of the now marker and the last round comes last owns the rail fade-out.
  const nowLineIsTail = timeline.nowLineIndex === groups.length;
  const hasBlocks = groups.length > 0 || timeline.nowLineIndex !== null;

  return (
    <div className={cn("relative", hasBlocks && RAIL_LEAD_IN_SPACING_CLASSNAME)}>
      {hasBlocks ? (
        <span aria-hidden className={getRailLeadInClassName()} />
      ) : null}

      {groups.map((group, index) => (
        <Fragment key={group.id}>
          {timeline.nowLineIndex === index ? (
            <TodayNowLine minutes={timeline.nowMinutes} />
          ) : null}
          <TodayTimeGroup
            group={group}
            state={group.state}
            timeZone={timeZone}
            minutesUntil={group.state === "upcoming" ? group.minutesUntil : null}
            isLastBeforeNowLine={
              timeline.nowLineIndex !== null &&
              timeline.nowLineIndex > 0 &&
              index === timeline.nowLineIndex - 1
            }
            isTail={index === groups.length - 1 && !nowLineIsTail}
            syncingKeys={syncingKeys}
            currentUserId={currentUserId}
            disableActions={disableActions}
            onActivate={onActivate}
          />
        </Fragment>
      ))}

      {nowLineIsTail ? (
        <TodayNowLine minutes={timeline.nowMinutes} isTail />
      ) : null}
    </div>
  );
}
