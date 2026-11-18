"use client";

import type { MeasurementUnit } from "@haccp/shared";
import type { RefObject } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { MeasurementDraft } from "../lib/answer-draft";
import {
  sanitizeMeasurementDraft,
  unitAllowsNegative,
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
  invalid?: boolean;
  describedById?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

/** Phone decimal keypads have no minus key, so units that go below zero get a sign toggle. */
export function MeasurementInput({
  id,
  unit,
  symbol,
  draft,
  separator,
  onChange,
  signLabel,
  invalid,
  describedById,
  inputRef,
  className,
}: Props) {
  const allowsNegative = unitAllowsNegative(unit);

  function handleInputChange(raw: string) {
    const sanitized = sanitizeMeasurementDraft(raw, separator, unit);

    // Explicit minus (typed or pasted) flips the sign; digits alone must not, or "18" on a freezer becomes +18.
    if (sanitized.startsWith("-")) {
      onChange({ sign: -1, digits: sanitized.slice(1) });
      return;
    }
    onChange({ sign: draft.sign, digits: sanitized });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {allowsNegative ? (
        <Toggle
          variant="outline"
          pressed={draft.sign < 0}
          onPressedChange={(pressed) =>
            onChange({ sign: pressed ? -1 : 1, digits: draft.digits })
          }
          aria-label={signLabel}
          className="size-(--control-h) shrink-0 text-lg aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80"
        >
          {draft.sign < 0 ? MINUS : "+"}
        </Toggle>
      ) : null}
      <InputGroup className="flex-1">
        <InputGroupInput
          id={id}
          ref={inputRef}
          // Not type="number": it rejects the bg decimal comma.
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={describedById}
          className="tabular-nums"
          value={draft.digits}
          onChange={(event) => handleInputChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{symbol}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
