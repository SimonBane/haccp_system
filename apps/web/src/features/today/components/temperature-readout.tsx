"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { tapFeedback } from "../lib/haptics";
import {
  formatTemperatureDraft,
  sanitizeTemperatureDraft,
  TEMP_MAX_MAGNITUDE,
  type TemperatureVerdict,
} from "../lib/temperature";

/** Typographic minus, so the pill lines up optically with the plus. */
const MINUS = "−";

const FINE_STEP = 0.1;
const COARSE_STEP = 1;

type Props = {
  /** "display" is fed by the keypad; "input" is typed into. */
  variant: "display" | "input";
  /** The reading without its sign — the pill carries that. */
  digits: string;
  sign: 1 | -1;
  parsed: number | null;
  separator: string;
  /** Settled verdict, so a half-typed number never colours the digits. */
  verdict: TemperatureVerdict | null;
  onSignChange: (next: 1 | -1) => void;
  onDigitsChange: (next: string) => void;
  onDraftChange: (next: string) => void;
  id?: string;
  describedById?: string;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  enterKeyHint?: "next" | "done";
  className?: string;
};

/**
 * The reading, and the only place its sign is shown or changed.
 *
 * Folding the sign into the number as a pill removes the separate segmented row
 * that used to sit between the readout and the keypad: one glance now confirms
 * both "is it negative" and "is it the right number", and the keypad gets the
 * 44px back. The sign is pre-selected from the equipment's range, so a freezer
 * reading is "1", "8" with no hunt for a minus.
 *
 * One component serves both platforms so they cannot drift. Which half renders
 * is decided by CSS in the reading step, not by a media-query hook — that keeps
 * the inactive one out of the tab order and immune to the hydration flip.
 */
export function TemperatureReadout({
  variant,
  digits,
  sign,
  parsed,
  separator,
  verdict,
  onSignChange,
  onDigitsChange,
  onDraftChange,
  id,
  describedById,
  invalid,
  inputRef,
  enterKeyHint = "done",
  className,
}: Props) {
  const t = useTranslations("TodayPage");

  const verdictClassName =
    verdict === "out_of_range"
      ? "text-destructive"
      : verdict === "ok"
        ? "text-success"
        : undefined;

  function step(delta: number) {
    if (parsed === null) return;
    const next = Math.round((parsed + delta) * 10) / 10;
    if (Math.abs(next) > TEMP_MAX_MAGNITUDE) return;
    onDraftChange(formatTemperatureDraft(next, separator));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const magnitude = event.shiftKey ? COARSE_STEP : FINE_STEP;
    step(event.key === "ArrowUp" ? magnitude : -magnitude);
  }

  function handleInputChange(raw: string) {
    const sanitized = sanitizeTemperatureDraft(raw, separator);

    // An explicit minus — typed, or pasted as "−19,2" — is an instruction about
    // the sign, so it goes through the draft and flips the pill. Anything else
    // is just digits and must not disturb the sign inferred from the equipment,
    // or typing "18" into a freezer's field would silently make it +18.
    if (sanitized.startsWith("-")) onDraftChange(sanitized);
    else onDigitsChange(sanitized);
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Toggle
        variant="outline"
        pressed={sign < 0}
        onPressedChange={(pressed) => {
          onSignChange(pressed ? -1 : 1);
          tapFeedback();
        }}
        aria-label={t("temperatureDialog.signToggleLabel")}
        className={cn(
          "size-11 shrink-0 rounded-full text-2xl font-medium md:size-11 md:text-xl",
          // The stock pressed style is a muted tint, too quiet for something a
          // worker has to confirm at a glance before typing.
          "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80",
        )}
      >
        {sign < 0 ? MINUS : "+"}
      </Toggle>

      {variant === "display" ? (
        <span
          className={cn(
            "text-6xl leading-none font-semibold tabular-nums transition-colors motion-reduce:transition-none landscape:text-4xl",
            digits === "" ? "text-muted-foreground/35" : verdictClassName,
          )}
        >
          {digits === "" ? "0" : digits}
        </span>
      ) : (
        <Input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint={enterKeyHint}
          aria-invalid={invalid}
          aria-describedby={describedById}
          value={digits}
          placeholder="0"
          className={cn(
            // Reads as a field. Borderless and transparent it was invisible
            // until something had been typed into it — a gap between the sign
            // pill and the unit with no hint that it was where to type.
            "h-16 w-36 rounded-xl text-center text-5xl font-semibold tabular-nums md:h-16 md:w-32 md:text-[2.65rem]",
            "placeholder:text-muted-foreground/35",
            verdictClassName,
          )}
          // Sanitising on change rather than filtering keystrokes: this is the
          // only path that also covers paste, drag-and-drop, autofill and soft
          // keyboards that report an unidentified key.
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}

      <span className="text-2xl font-normal text-muted-foreground md:text-xl">
        °C
      </span>
    </div>
  );
}
