"use client";

import type { CorrectiveAnswer } from "@haccp/shared";
import { ChoiceToggles } from "./choice-toggles";

type Props = {
  answers: readonly CorrectiveAnswer[];
  multiple: boolean;
  selected: readonly string[];
  disabled?: boolean;
  /** Shown for an answer whose label is still blank in the builder. */
  untitledLabel?: string;
  ariaLabel?: string;
  onToggle: (answerId: string) => void;
};

/** A form's corrective answers, laid out like any other choice. */
export function CorrectiveAnswers({
  answers,
  multiple,
  selected,
  disabled,
  untitledLabel,
  ariaLabel,
  onToggle,
}: Props) {
  return (
    <ChoiceToggles
      options={answers}
      selected={selected}
      multiple={multiple}
      disabled={disabled}
      untitledLabel={untitledLabel}
      ariaLabel={ariaLabel}
      onChange={(next) => {
        const toggled =
          next.find((id) => !selected.includes(id)) ??
          selected.find((id) => !next.includes(id));
        if (toggled) onToggle(toggled);
      }}
    />
  );
}
