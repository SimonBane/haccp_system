"use client";

import type { MeasurementUnit } from "@haccp/shared";
import type { KeyboardEventHandler, RefObject } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Toggle } from "@/components/ui/toggle";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { cn } from "@/lib/utils";
import type { MeasurementDraft } from "../lib/answer-draft";
import {
  sanitizeMeasurementDraft,
  unitAllowsNegative,
  type MeasurementVerdict,
} from "../lib/measurement";

const MINUS = "−";

type Props = {
  id: string;
  unit: MeasurementUnit;
  symbol: string;
  draft: MeasurementDraft;
  separator: string;
  onChange: (next: MeasurementDraft) => void;
  signLabel: string;
  /** Tints the reading as soon as it can be judged against its limits. */
  verdict?: MeasurementVerdict | null;
  invalid?: boolean;
  disabled?: boolean;
  /** A fixed-width, shorter field that fits on a list row. */
  compact?: boolean;
  describedById?: string;
  ariaLabel?: string;
  enterKeyHint?: "next" | "done";
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

/** Phone decimal keypads have no minus key, so touch screens get a sign toggle; a keyboard types the minus. */
export function MeasurementInput({
  id,
  unit,
  symbol,
  draft,
  separator,
  onChange,
  signLabel,
  verdict,
  invalid,
  disabled,
  compact = false,
  describedById,
  ariaLabel,
  enterKeyHint,
  onKeyDown,
  inputRef,
  className,
}: Props) {
  const isTouch = useCoarsePointer();
  const showSign = unitAllowsNegative(unit) && isTouch;

  // Typed by keyboard the minus is part of the text, so a fresh freezer reading is not silently negative.
  const text = showSign
    ? draft.digits
    : draft.sign < 0 && draft.digits !== ""
      ? `-${draft.digits}`
      : draft.digits;

  function handleInputChange(raw: string) {
    const sanitized = sanitizeMeasurementDraft(raw, separator, unit);

    if (!showSign) {
      onChange({ sign: 1, digits: sanitized });
      return;
    }
    // Explicit minus (typed or pasted) flips the sign; digits alone must not, or "18" on a freezer becomes +18.
    if (sanitized.startsWith("-")) {
      onChange({ sign: -1, digits: sanitized.slice(1) });
      return;
    }
    onChange({ sign: draft.sign, digits: sanitized });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showSign ? (
        <Toggle
          variant="outline"
          pressed={draft.sign < 0}
          onPressedChange={(pressed) =>
            onChange({ sign: pressed ? -1 : 1, digits: draft.digits })
          }
          aria-label={signLabel}
          disabled={disabled}
          className={cn(
            "size-11 shrink-0 text-lg aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80",
            compact ? "md:size-8" : "md:size-9",
          )}
        >
          {draft.sign < 0 ? MINUS : "+"}
        </Toggle>
      ) : null}
      <InputGroup
        className={cn(
          compact ? "h-11 w-32 flex-none md:h-8" : "flex-1",
          verdict === "pass" &&
            "border-success has-[[data-slot=input-group-control]:focus-visible]:border-success has-[[data-slot=input-group-control]:focus-visible]:ring-success/30",
          verdict === "fail" &&
            "border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/20 dark:has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/40",
        )}
      >
        <InputGroupInput
          id={id}
          ref={inputRef}
          // Not type="number": it rejects the bg decimal comma.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint={enterKeyHint}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          aria-describedby={describedById}
          // The left padding balances the unit on the right; a minus (about 0.47em) eats into it so the digits stay centred.
          className={cn(
            "text-center text-base font-semibold tabular-nums md:text-base",
            text.startsWith("-") ? "pl-[calc(2rem-0.47em)]" : "pl-8",
            verdict === "pass" && "text-success",
            verdict === "fail" && "text-destructive",
          )}
          value={text}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{symbol}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
