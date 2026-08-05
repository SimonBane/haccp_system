"use client";

import { useEffect, useRef } from "react";
import { scrollToTimeGroup } from "../lib/scroll";
import type { TodayTimeline as Timeline, TodayTimelineItem } from "../lib/today-timeline";
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

  return (
    <div className="relative">
      {groups.map((group, index) => (
        <TodayTimeGroup
          key={group.id}
          group={group}
          isLast={index === groups.length - 1}
          syncingKeys={syncingKeys}
          currentUserId={currentUserId}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
}
