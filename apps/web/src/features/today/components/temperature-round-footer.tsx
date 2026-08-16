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
  canSkip: boolean;
  skipLabel: string;
  onSkip: () => void;
  showBack: boolean;
  backLabel: string;
  onBack: () => void;
};

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
    <div className="flex w-full items-center gap-2 md:gap-3">
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
