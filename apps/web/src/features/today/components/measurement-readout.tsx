"use client";

import { MEASUREMENT_UNITS, type MeasurementUnit } from "@haccp/shared";
import type { KeyboardEvent, RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import type { MeasurementDraft } from "@/features/forms/lib/answer-draft";
import {
  formatMeasurementDraft,
  parseMeasurementDraft,
  composeSignedDraft,
  sanitizeMeasurementDraft,
  unitAllowsNegative,
  unitDecimals,
  type MeasurementVerdict,
} from "@/features/forms/lib/measurement";
import { cn } from "@/lib/utils";
import { tapFeedback } from "../lib/haptics";

const MINUS = "−";

type Props = {
  unit: MeasurementUnit;
  symbol: string;
  draft: MeasurementDraft;
  separator: string;
  /** Settled verdict — a half-typed number must not colour the digits. */
  verdict: MeasurementVerdict | null;
  onChange: (next: MeasurementDraft) => void;
  label: string;
  signLabel: string;
  id?: string;
  describedById?: string;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

/** The large single-reading entry: a sign pill for phone keypads without a minus, arrows to nudge. */
export function MeasurementReadout({
  unit,
  symbol,
  draft,
  separator,
  verdict,
  onChange,
  label,
  signLabel,
  id,
  describedById,
  invalid,
  inputRef,
  className,
}: Props) {
  const allowsNegative = unitAllowsNegative(unit);
  const spec = MEASUREMENT_UNITS[unit];
  const fineStep = 10 ** -unitDecimals(unit);

  const verdictClassName =
    verdict === "fail"
      ? "text-destructive"
      : verdict === "pass"
        ? "text-success"
        : undefined;

  function step(delta: number) {
    const current = parseMeasurementDraft(
      composeSignedDraft(draft.sign, draft.digits),
    );
    if (current === null) return;

    const next = current + delta;
    if (next < spec.min || next > spec.max) return;

    const formatted = formatMeasurementDraft(Math.abs(next), separator, unit);
    onChange({ sign: next < 0 ? -1 : draft.sign, digits: formatted });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const magnitude = event.shiftKey ? fineStep * 10 : fineStep;
    step(event.key === "ArrowUp" ? magnitude : -magnitude);
  }

  function handleInputChange(raw: string) {
    const sanitized = sanitizeMeasurementDraft(raw, separator, unit);

    // Explicit minus (typed or pasted) flips the pill; digits must not, or "18" on a freezer becomes +18.
    if (sanitized.startsWith("-")) {
      onChange({ sign: -1, digits: sanitized.slice(1) });
      return;
    }
    onChange({ sign: draft.sign, digits: sanitized });
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {allowsNegative ? (
        <Toggle
          variant="outline"
          pressed={draft.sign < 0}
          onPressedChange={(pressed) => {
            onChange({ sign: pressed ? -1 : 1, digits: draft.digits });
            tapFeedback();
          }}
          aria-label={signLabel}
          className={cn(
            "size-11 shrink-0 rounded-full text-2xl font-medium md:size-11 md:text-xl",
            "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80",
          )}
        >
          {draft.sign < 0 ? MINUS : "+"}
        </Toggle>
      ) : null}

      <Input
        id={id}
        ref={inputRef}
        // Not type="number": it rejects the bg decimal comma, and setSelectionRange throws on it.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        // No visible label: the sign toggle and the unit suffix carry the meaning visually.
        aria-label={label}
        data-testid="measurement-reading"
        aria-invalid={invalid}
        aria-describedby={describedById}
        value={draft.digits}
        placeholder="0"
        className={cn(
          "h-20 w-36 rounded-xl text-center text-5xl font-semibold tabular-nums",
          "md:h-16 md:w-32 md:text-[2.65rem]",
          "landscape:h-14 landscape:text-4xl md:landscape:h-16",
          "placeholder:text-muted-foreground/35",
          verdictClassName,
        )}
        // Sanitize on change so paste, autofill, and IME are covered.
        onChange={(event) => handleInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <span className="text-2xl font-normal text-muted-foreground md:text-xl">
        {symbol}
      </span>
    </div>
  );
}
