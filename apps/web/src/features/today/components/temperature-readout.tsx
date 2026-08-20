"use client";

import { TEMPERATURE_RESULT } from "@haccp/shared";
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

const MINUS = "−";

const FINE_STEP = 0.1;
const COARSE_STEP = 1;

type Props = {
  digits: string;
  sign: 1 | -1;
  parsed: number | null;
  separator: string;
  /** Settled verdict — a half-typed number must not colour the digits. */
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

export function TemperatureReadout({
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
    verdict === TEMPERATURE_RESULT.OUT_OF_RANGE
      ? "text-destructive"
      : verdict === TEMPERATURE_RESULT.OK
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

    // Explicit minus (typed or pasted) flips the pill; digits must not, or "18" on a freezer becomes +18.
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
          "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80",
        )}
      >
        {sign < 0 ? MINUS : "+"}
      </Toggle>

      <Input
        id={id}
        ref={inputRef}
        // Not type="number": it rejects the bg decimal comma, and setSelectionRange throws on it.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        // No visible label: the sign toggle and the °C suffix carry the meaning visually.
        aria-label={t("temperatureDialog.readingLabel")}
        data-testid="temperature-reading"
        aria-invalid={invalid}
        aria-describedby={describedById}
        value={digits}
        placeholder="0"
        className={cn(
          "h-20 w-32 rounded-xl text-center text-5xl font-semibold tabular-nums",
          "md:h-16 md:w-28 md:text-[2.65rem]",
          "landscape:h-14 landscape:text-4xl md:landscape:h-16",
          "placeholder:text-muted-foreground/35",
          verdictClassName,
        )}
        // Sanitize on change so paste, autofill, and IME are covered.
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <span className="text-2xl font-normal text-muted-foreground md:text-xl">
        °C
      </span>
    </div>
  );
}
