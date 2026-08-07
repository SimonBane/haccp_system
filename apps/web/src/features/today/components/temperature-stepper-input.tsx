"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { KeyboardEvent, RefObject } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  TEMP_MAX_MAGNITUDE,
  formatTemperatureDraft,
  parseTemperatureDraft,
  sanitizeTemperatureDraft,
} from "../lib/temperature";

type Props = {
  id: string;
  describedById: string;
  value: string;
  onValueChange: (next: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  separator: string;
  inputRef: RefObject<HTMLInputElement | null>;
  className?: string;
};

const FINE_STEP = 0.1;
const COARSE_STEP = 1;

/**
 * The desktop reading control. Compact on purpose: a two-digit number does not
 * need a 56px-tall field, and the previous one accepted arbitrary text.
 */
export function TemperatureStepperInput({
  id,
  describedById,
  value,
  onValueChange,
  onBlur,
  invalid,
  separator,
  inputRef,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const parsed = parseTemperatureDraft(value);

  function step(delta: number) {
    if (parsed === null) return;
    const next = Math.round((parsed + delta) * 10) / 10;
    if (Math.abs(next) > TEMP_MAX_MAGNITUDE) return;
    onValueChange(formatTemperatureDraft(next, separator));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const magnitude = event.shiftKey ? COARSE_STEP : FINE_STEP;
    step(event.key === "ArrowUp" ? magnitude : -magnitude);
  }

  return (
    <Field data-invalid={invalid} className={className}>
      <FieldLabel htmlFor={id} className="mx-auto">
        {t("temperatureDialog.recordedCLabel")}
      </FieldLabel>

      {/* Field's vertical variant stretches its direct children to full width,
          which would beat w-40 on the group itself. */}
      <div className="flex justify-center">
        <InputGroup className="h-11 w-40">
          <InputGroupAddon align="inline-start">
            <InputGroupButton
              size="icon-sm"
              aria-label={t("temperatureDialog.decrement")}
              disabled={parsed === null}
              onClick={() => step(-FINE_STEP)}
            >
              <MinusIcon />
            </InputGroupButton>
          </InputGroupAddon>

          <InputGroupInput
            id={id}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={invalid}
            aria-describedby={describedById}
            className={cn("h-11 text-center text-2xl font-semibold tabular-nums")}
            value={value}
            // Sanitising here rather than filtering keystrokes: onChange is the
            // only path that also covers paste, drag-and-drop, autofill and
            // soft keyboards that report an unidentified key.
            onChange={(event) =>
              onValueChange(
                sanitizeTemperatureDraft(event.target.value, separator),
              )
            }
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
          />

          <InputGroupAddon align="inline-end">
            <InputGroupText className="text-sm">°C</InputGroupText>
            <InputGroupButton
              size="icon-sm"
              aria-label={t("temperatureDialog.increment")}
              disabled={parsed === null}
              onClick={() => step(FINE_STEP)}
            >
              <PlusIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </Field>
  );
}
