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
  /** Changes when the day changes, so the auto-scroll runs once per day. */
  scrollKey: string;
  syncingKeys: ReadonlySet<string>;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

export function TodayTimeline({
  timeline,
  scrollKey,
  syncingKeys,
  currentUserId,
  onActivate,
}: Props) {
  const scrolledFor = useRef<string | null>(null);
  const { focusGroupId, groups } = timeline;

  useEffect(() => {
    if (scrolledFor.current === scrollKey) return;
    scrolledFor.current = scrollKey;

    if (!focusGroupId) return;
    // Early in the day the live group is already the first one, so scrolling
    // would only push the header off screen for no reason.
    if (groups[0]?.id === focusGroupId) return;

    scrollToTimeGroup(focusGroupId);
  }, [scrollKey, focusGroupId, groups]);

  // The now marker is a dot on the same axis as the rounds, so whichever of
  // the two comes last owns the rail's fade-out.
  const nowLineIsTail = timeline.nowLineIndex === groups.length;
  const hasBlocks = groups.length > 0 || timeline.nowLineIndex !== null;

  return (
    <div className={cn("relative", hasBlocks && RAIL_LEAD_IN_SPACING_CLASSNAME)}>
      {/* The day does not begin at its first check, so the axis runs in from
          above rather than starting on a bare dot. */}
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
            isLastBeforeNowLine={
              timeline.nowLineIndex !== null &&
              timeline.nowLineIndex > 0 &&
              index === timeline.nowLineIndex - 1
            }
            isTail={index === groups.length - 1 && !nowLineIsTail}
            syncingKeys={syncingKeys}
            currentUserId={currentUserId}
            onActivate={onActivate}
          />
        </Fragment>
      ))}

      {/* Every round has already passed, so the marker closes out the day. */}
      {nowLineIsTail ? (
        <TodayNowLine minutes={timeline.nowMinutes} isTail />
      ) : null}
    </div>
  );
}
