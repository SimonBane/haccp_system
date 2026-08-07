"use client";

import { DeleteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tapFeedback } from "../lib/haptics";
import { sanitizeTemperatureDraft } from "../lib/temperature";

type Props = {
  /** Current digits, sign excluded — the sign lives outside the keypad. */
  digits: string;
  onDigitsChange: (next: string) => void;
  /** "," in bg, "." in en — matches what the parser accepts. */
  separator: string;
  className?: string;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const KEY_CLASS = "h-full min-h-12 rounded-xl text-2xl font-medium hover:bg-muted";

/**
 * Replaces the OS keyboard: the modal keeps its full height, nothing slides over
 * the form, and the keys stay big enough for gloved hands.
 *
 * There is no sign key. The sign is inferred from the equipment and shown as a
 * segmented control above, so a freezer reading is "1", "8" rather than a hunt
 * for the minus.
 */
export function NumericKeypad({
  digits,
  onDigitsChange,
  separator,
  className,
}: Props) {
  const t = useTranslations("TodayPage");

  function append(character: string) {
    // A leading separator gets an explicit zero — ",5" is hard to read at a glance.
    const candidate =
      digits.length === 0 && character === separator
        ? `0${separator}`
        : `${digits}${character}`;
    const next = sanitizeTemperatureDraft(candidate, separator);

    // The grammar refused it: two decimal points, or a third integer digit.
    // Stay silent as well as still — a buzz on a no-op teaches the wrong thing.
    if (next === digits) return;

    onDigitsChange(next);
    tapFeedback(8);
  }

  function backspace() {
    if (digits.length === 0) return;
    onDigitsChange(digits.slice(0, -1));
    tapFeedback(8);
  }

  return (
    <div className={cn("grid grid-cols-3 grid-rows-4 gap-2", className)}>
      {DIGITS.map((digit) => (
        <Button
          key={digit}
          variant="ghost"
          className={KEY_CLASS}
          onClick={() => append(digit)}
        >
          {digit}
        </Button>
      ))}

      <Button
        variant="ghost"
        className={KEY_CLASS}
        aria-label={t("keypad.decimal")}
        onClick={() => append(separator)}
      >
        {separator}
      </Button>
      <Button variant="ghost" className={KEY_CLASS} onClick={() => append("0")}>
        0
      </Button>
      <Button
        variant="ghost"
        className={KEY_CLASS}
        aria-label={t("keypad.backspace")}
        disabled={digits.length === 0}
        onClick={backspace}
      >
        <DeleteIcon className="size-6" />
      </Button>
    </div>
  );
}
