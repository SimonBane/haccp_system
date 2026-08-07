"use client";

import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Props = {
  /** Canonical signed draft, e.g. "-19,2". */
  value: string;
  sign: 1 | -1;
  onSignChange: (next: 1 | -1) => void;
  className?: string;
};

/** Typographic minus, so the placeholder lines up with the entered value. */
const MINUS = "−";

// The stock pressed style is a muted tint, which is too quiet for something a
// worker has to confirm at a glance before typing.
const SIGN_ITEM_CLASS =
  "h-11 flex-1 text-lg aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80";

/**
 * The mobile reading readout: a large display and the sign as a visible
 * two-state control rather than a mode hidden behind a keypad button.
 *
 * The sign is pre-selected from the equipment's range, so a freezer reading is
 * "1", "8" with no hunt for the minus — and because it is tracked separately
 * from the digits, clearing a typo cannot silently drop it.
 */
export function TemperatureKeypadEntry({
  value,
  sign,
  onSignChange,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const isEmpty = value.replace(/^-/, "") === "";

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* Grows into whatever the keypad does not use, so a tall phone puts the
          number in the middle of the upper half rather than leaving a void. */}
      <div className="flex min-h-20 flex-1 items-center justify-center landscape:min-h-14">
        <span
          className={cn(
            "text-6xl leading-none font-semibold tabular-nums landscape:text-4xl",
            isEmpty && "text-muted-foreground/35",
          )}
        >
          {isEmpty
            ? `${sign < 0 ? MINUS : ""}0`
            : value.replace("-", MINUS)}
        </span>
        <span className="ml-2 text-2xl font-normal text-muted-foreground">
          °C
        </span>
      </div>

      <ToggleGroup
        spacing={0}
        variant="outline"
        className="w-full"
        aria-label={t("temperatureDialog.signGroupLabel")}
        value={[sign < 0 ? "neg" : "pos"]}
        onValueChange={(next) => {
          // Base UI allows toggling the active item off, which would leave the
          // reading with no sign at all.
          const selected = next[0];
          if (!selected) return;
          onSignChange(selected === "neg" ? -1 : 1);
        }}
      >
        <ToggleGroupItem
          value="neg"
          aria-label={t("temperatureDialog.signNegative")}
          className={SIGN_ITEM_CLASS}
        >
          {MINUS}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="pos"
          aria-label={t("temperatureDialog.signPositive")}
          className={SIGN_ITEM_CLASS}
        >
          +
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
