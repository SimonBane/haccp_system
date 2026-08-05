"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const MAX_LENGTH = 6;

type Props = {
  value: string;
  onValueChange: (next: string) => void;
  /** "," in bg, "." in en — matches what the parser accepts. */
  separator: string;
};

/**
 * Replaces the OS keyboard on mobile: the sheet can size itself to its content,
 * nothing slides over the form, and the keys stay big enough for cold hands.
 */
export function NumericKeypad({ value, onValueChange, separator }: Props) {
  const t = useTranslations("TodayPage");

  function appendDigit(digit: string) {
    if (value.replace("-", "").length >= MAX_LENGTH) return;
    onValueChange(value + digit);
  }

  function appendSeparator() {
    if (value.includes(separator)) return;
    onValueChange(value.length === 0 ? `0${separator}` : value + separator);
  }

  function toggleSign() {
    onValueChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
  }

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="grid grid-cols-3 gap-2">
      {digits.map((digit) => (
        <Button
          key={digit}
          variant="ghost"
          className="h-14 rounded-xl text-xl font-medium hover:bg-muted"
          onClick={() => appendDigit(digit)}
        >
          {digit}
        </Button>
      ))}

      <Button
        variant="ghost"
        className="h-14 rounded-xl text-xl font-medium hover:bg-muted"
        aria-label={t("keypad.toggleSign")}
        onClick={toggleSign}
      >
        ±
      </Button>
      <Button
        variant="ghost"
        className="h-14 rounded-xl text-xl font-medium hover:bg-muted"
        onClick={() => appendDigit("0")}
      >
        0
      </Button>
      <Button
        variant="ghost"
        className="h-14 rounded-xl text-xl font-medium hover:bg-muted"
        aria-label={t("keypad.decimal")}
        onClick={appendSeparator}
      >
        {separator}
      </Button>
    </div>
  );
}
