"use client";

import { useCallback, useEffect, useState } from "react";
import { parseTemperatureDraft } from "../lib/temperature";

const SETTLE_DELAY_MS = 600;

/**
 * Holds back the reading the verdict is judged on until typing stops.
 *
 * Judging every keystroke means a freezer reading of -18 is briefly -1, which
 * flashes "out of range" in red halfway through a correct entry. Delaying it
 * lets the gauge track live while the words and colours change only once the
 * number is finished.
 *
 * It settles the draft rather than the verdict so the two can never disagree —
 * deriving the verdict from the live value while showing the settled one
 * produced sentences like "-1 °C, within the allowed range".
 */
export function useSettledReading(
  draft: string,
  delayMs = SETTLE_DELAY_MS,
): { settled: string; flush: () => void } {
  const [settled, setSettled] = useState(draft);
  const [tracked, setTracked] = useState(draft);

  // Adjusted while rendering rather than in an effect, because an incomplete
  // draft has to clear the verdict instantly: it can never raise a false alarm,
  // and a badge that lingers after a backspace just looks broken.
  if (draft !== tracked) {
    setTracked(draft);
    if (parseTemperatureDraft(draft) === null) setSettled(draft);
  }

  useEffect(() => {
    if (draft === settled || parseTemperatureDraft(draft) === null) return;

    const timer = setTimeout(() => setSettled(draft), delayMs);
    return () => clearTimeout(timer);
  }, [draft, settled, delayMs]);

  /**
   * Skips the wait. Called when the worker commits, so stepping forward and back
   * lands on the settled state instead of restarting the delay from neutral.
   */
  const flush = useCallback(() => setSettled(draft), [draft]);

  return { settled, flush };
}
