import { occurrenceKey } from "./today-grouping";
import { findTimelineGroup } from "./today-timeline";
import type {
  TodayTimeGroup,
  TodayTimeline,
  TodayTimelineItem,
} from "./today-timeline";

/**
 * A round is one walk-around: the temperature checks that share a scheduled
 * time, recorded back to back without returning to the list between them.
 */

/**
 * Whether a check can be recorded at all, and therefore whether it can take part
 * in a round. The entry surface needs a range to judge against and a piece of
 * equipment to attribute the reading to, so a template missing either is not
 * something the flow can offer — `today-view` turns a direct tap on one into an
 * error toast rather than an empty dialog.
 */
export function isChainableTemperatureItem(item: TodayTimelineItem): boolean {
  return (
    item.task.type === "temperature" &&
    !item.isCompleted &&
    item.task.minTempC !== null &&
    item.task.maxTempC !== null &&
    Boolean(item.task.equipmentId)
  );
}

export function chainableTemperatureItems(
  group: TodayTimeGroup,
): TodayTimelineItem[] {
  return group.items.filter(isChainableTemperatureItem);
}

/**
 * The queue for a round started at `tapped`, as occurrence keys.
 *
 * It runs from the tapped check to the end of its group and does not wrap. The
 * counter then reads "1 / 3" for the third of five, which is what actually
 * happens — "3 / 5" would promise the flow comes back for the two above it. The
 * round starts from the group header instead when the worker wants all of them.
 */
export function buildTemperatureRoundKeys(
  timeline: TodayTimeline,
  tapped: TodayTimelineItem,
): string[] {
  const tappedKey = occurrenceKey(tapped.task);
  const group = findTimelineGroup(timeline, tappedKey);
  if (!group) return [tappedKey];

  const pending = chainableTemperatureItems(group).map((item) =>
    occurrenceKey(item.task),
  );

  const start = pending.indexOf(tappedKey);
  // A tapped check that is not chainable never reaches the flow, but a queue of
  // one is still the honest answer if it somehow does.
  if (start === -1) return [tappedKey];

  return pending.slice(start);
}
