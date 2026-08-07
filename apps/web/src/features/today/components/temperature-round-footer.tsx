"use client";

import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tapFeedback } from "../lib/haptics";

type Props = {
  primaryIcon: "continue" | "confirm";
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryLoading: boolean;
  onPrimary: () => void;
  /** Only rendered mid-round; a single check has nothing to skip to. */
  canSkip: boolean;
  skipLabel: string;
  onSkip: () => void;
  showBack: boolean;
  backLabel: string;
  onBack: () => void;
};

/**
 * The commit row, and the reason the whole surface was rebuilt.
 *
 * On a phone the primary is full width and 56px tall, directly under the keypad
 * — the thumb is already there. It used to be a 44px icon in the top-right
 * corner, deliberately far from the keys, which made the most repeated action in
 * the app a diagonal one-handed reach on every single reading.
 *
 * The mis-tap that placement was guarding against is survivable here: the key
 * immediately above the primary's right edge is backspace, so overshooting
 * upward deletes a digit and, if the draft stops parsing, disables the primary.
 * A separator, a filled-versus-ghost contrast and the 5s undo toast cover the
 * rest.
 *
 * Skip sits on the left so the thumb's natural arc lands on the primary. It
 * carries a border rather than sitting borderless like a ghost button — with
 * no fill of its own next to a filled primary, an unbordered Skip read as
 * disabled rather than as a second, quieter action.
 */
export function TemperatureRoundFooter({
  primaryIcon,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  onPrimary,
  canSkip,
  skipLabel,
  onSkip,
  showBack,
  backLabel,
  onBack,
}: Props) {
  const t = useTranslations("TodayPage");
  const PrimaryIcon = primaryIcon === "confirm" ? CheckIcon : ArrowRightIcon;

  return (
    // No w-full and no mr-auto push: both are percentage-flavoured sizing that
    // resolve against the row's own max-content while the desktop dialog's grid
    // column is being sized, which floors the dialog at the row's uncompressed
    // width — that is what forced a horizontal scrollbar under the longer
    // Bulgarian labels. Left to hug its own content, the cluster centers
    // cleanly via justify-center on the dialog's footer instead.
    <div className="flex w-full items-center gap-2 md:gap-3">
      {/* On a phone the app bar already carries Back as the leading control. */}
      {showBack ? (
        <Button
          variant="outline"
          className="hidden md:inline-flex md:flex-1"
          onClick={onBack}
        >
          {backLabel}
        </Button>
      ) : null}

      {canSkip ? (
        <Button
          variant="outline"
          className="min-h-14 flex-1 rounded-2xl px-4 text-muted-foreground shadow-xs md:min-h-10 md:flex-1 md:rounded-md md:shadow-none"
          aria-label={skipLabel}
          disabled={primaryLoading}
          onClick={() => {
            tapFeedback();
            onSkip();
          }}
        >
          {t("temperatureDialog.skip")}
        </Button>
      ) : null}

      <Button
        className={cn(
          "min-h-14 rounded-2xl text-base font-semibold shadow-xs md:min-h-10 md:flex-1 md:rounded-md md:text-sm md:shadow-none",
          canSkip ? "flex-[1.4]" : "flex-1",
        )}
        disabled={primaryDisabled}
        isLoading={primaryLoading}
        onClick={onPrimary}
      >
        <PrimaryIcon data-icon="inline-start" />
        {primaryLabel}
      </Button>
    </div>
  );
}
