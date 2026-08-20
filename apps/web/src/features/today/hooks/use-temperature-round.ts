"use client";

import { TEMPERATURE_RESULT } from "@haccp/shared";
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
 * Walks one round of temperature checks. The key list is frozen on open (a
 * recomputed queue would drop the current check); `advance` and the tally use
 * refs because they run after an awaited mutation.
 */
export function useTemperatureRound(timeline: TodayTimeline) {
  const [state, setState] = useState<RoundState | null>(null);
  const stateRef = useRef<RoundState | null>(null);
  const tallyRef = useRef<RoundTally>(emptyTally());

  const timelineRef = useRef(timeline);

  // After commit — writing a ref during render is forbidden by react-hooks/refs.
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

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

  /** Next pending check, or the tally once nothing is left. */
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
    if (verdict === TEMPERATURE_RESULT.OUT_OF_RANGE) tallyRef.current.deviations += 1;
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

  // Day rolled over or the template was removed; the index only grows so this cannot loop.
  useEffect(() => {
    if (state && !item) advance();
  }, [state, item, advance]);

  return {
    item,
    currentKey,
    position: state ? state.index + 1 : 0,
    size: state ? state.keys.length : 0,
    isRound: (state?.keys.length ?? 0) > 1,
    open,
    recordSaved,
    advance,
    skip,
    close,
  };
}
