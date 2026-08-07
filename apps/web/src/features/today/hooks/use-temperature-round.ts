"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TemperatureVerdict } from "../lib/temperature";
import { buildTemperatureRoundKeys } from "../lib/today-round";
import { findTimelineItem } from "../lib/today-timeline";
import type { TodayTimeline, TodayTimelineItem } from "../lib/today-timeline";

type RoundState = { keys: readonly string[]; index: number };

export type RoundTally = { saved: number; deviations: number; skipped: number };

export type AdvanceResult = { done: false } | ({ done: true } & RoundTally);

function emptyTally(): RoundTally {
  return { saved: 0, deviations: 0, skipped: 0 };
}

/**
 * Walks a worker through one round of temperature checks without returning to
 * the list between them.
 *
 * Three things make this survive a timeline that rebuilds under it:
 *
 * 1. The key list is frozen when the round opens and only the index moves. The
 *    clock ticks every minute and the optimistic patch flips the row you just
 *    saved to completed — a queue recomputed from "still pending" would drop the
 *    check you are standing on and renumber the counter behind you.
 * 2. `advance` reads the timeline and the round through refs. It runs after an
 *    awaited mutation, so the closure it was created in is a render behind the
 *    cache patch; refs are what let it see the world as it is now.
 * 3. The tally is a ref rather than state. It is never rendered, only read once
 *    inside the same handler tick that bumped it, where state would be stale.
 */
export function useTemperatureRound(timeline: TodayTimeline) {
  const [state, setState] = useState<RoundState | null>(null);
  const stateRef = useRef<RoundState | null>(null);
  const tallyRef = useRef<RoundTally>(emptyTally());

  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const commit = useCallback((next: RoundState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const open = useCallback(
    (item: TodayTimelineItem) => {
      tallyRef.current = emptyTally();
      commit({
        keys: buildTemperatureRoundKeys(timelineRef.current, item),
        index: 0,
      });
    },
    [commit],
  );

  /**
   * Moves to the next check still worth recording, skipping any that were
   * completed on another device or stopped resolving. Returns the tally once
   * nothing is left, so the caller can summarise the round in one toast.
   */
  const advance = useCallback((): AdvanceResult => {
    const current = stateRef.current;
    if (!current) return { done: true, ...tallyRef.current };

    for (let next = current.index + 1; next < current.keys.length; next += 1) {
      const item = findTimelineItem(timelineRef.current, current.keys[next]);
      if (item && !item.isCompleted) {
        commit({ keys: current.keys, index: next });
        return { done: false };
      }
    }

    commit(null);
    return { done: true, ...tallyRef.current };
  }, [commit]);

  const recordSaved = useCallback((verdict: TemperatureVerdict) => {
    tallyRef.current.saved += 1;
    if (verdict === "out_of_range") tallyRef.current.deviations += 1;
  }, []);

  const skip = useCallback((): AdvanceResult => {
    tallyRef.current.skipped += 1;
    return advance();
  }, [advance]);

  const close = useCallback((): RoundTally => {
    const final = { ...tallyRef.current };
    commit(null);
    return final;
  }, [commit]);

  const currentKey = state ? (state.keys[state.index] ?? null) : null;
  const item = findTimelineItem(timeline, currentKey);

  // The occurrence stopped resolving — the day rolled over mid-round, or the
  // template was removed. Move on rather than holding a surface open over a
  // check that no longer exists. The index only ever grows, so this cannot loop.
  useEffect(() => {
    if (state && !item) advance();
  }, [state, item, advance]);

  return {
    item,
    currentKey,
    position: state ? state.index + 1 : 0,
    size: state ? state.keys.length : 0,
    /** A round of one is the old one-task-per-open flow, with no round chrome. */
    isRound: (state?.keys.length ?? 0) > 1,
    open,
    recordSaved,
    advance,
    skip,
    close,
  };
}
