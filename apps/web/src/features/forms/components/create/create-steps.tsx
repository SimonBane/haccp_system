"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MobileHeaderTitle } from "@/components/layout/shell-slots";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const CREATE_STEPS = ["start", "setup", "fields"] as const;

export type CreateStep = (typeof CREATE_STEPS)[number];

/** Title on the left, progress in the middle, close on the right, as on every new-form step. */
export function CreateStepsHeader({ current }: { current: CreateStep }) {
  const t = useTranslations("FormsPage.create");
  const isMobile = useIsMobile();
  const currentIndex = CREATE_STEPS.indexOf(current);

  const close = (
    <Button
      variant="ghost"
      size="icon"
      render={<Link href="/dashboard/forms" />}
      nativeButton={false}
      aria-label={t("close")}
    >
      <XIcon />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <MobileHeaderTitle>{t("title")}</MobileHeaderTitle>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("stepOf", { current: currentIndex + 1, total: CREATE_STEPS.length })}
          </span>
          {close}
        </div>
      </>
    );
  }

  return (
    <header className="-mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-4 pb-3 sm:-mx-6 sm:px-6">
      <span className="font-semibold">{t("title")}</span>
      <ol className="flex items-center gap-2.5" aria-label={t("progress")}>
        {CREATE_STEPS.map((step, index) => {
          const done = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step}
              className="flex items-center gap-2.5"
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 ? (
                <span className="h-px w-8 bg-border" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-medium text-muted-foreground",
                  (done || isCurrent) && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                    done && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary ring-3 ring-primary/15",
                  )}
                >
                  {done ? <CheckIcon className="size-3" aria-hidden /> : index + 1}
                </span>
                {t(`steps.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex justify-end">{close}</div>
    </header>
  );
}
