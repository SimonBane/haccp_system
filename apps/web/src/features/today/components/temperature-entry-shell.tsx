"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  SHEET_FOOTER,
  SHEET_SURFACE,
  SheetAppBar,
} from "@/components/ui/responsive-form-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Props = {
  /** Kept mounted while false so the exit transition can run. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  leading: "close" | "back";
  leadingLabel: string;
  onLeading: () => void;
  round: { position: number; size: number } | null;
  footer: ReactNode;
  initialFocus?: RefObject<HTMLInputElement | null>;
  children: ReactNode;
};

/** Sheet on phone, dialog from md. Not ResponsiveFormDialog: needs a back control and round counter. */
export function TemperatureEntryShell({
  open,
  onOpenChange,
  title,
  subtitle,
  leading,
  leadingLabel,
  onLeading,
  round,
  footer,
  initialFocus,
  children,
}: Props) {
  const t = useTranslations("TodayPage");
  const LeadingIcon = leading === "close" ? XIcon : ArrowLeftIcon;

  // Spoken and shown forms are separate: aria-label on a span is unreliable, and "2 / 5" reads as "two slash five".
  const counter = round ? (
    <Badge variant="secondary" className="tabular-nums">
      <span aria-hidden>
        {t("temperatureDialog.roundProgress", {
          position: round.position,
          total: round.size,
        })}
      </span>
      <span className="sr-only">
        {t("temperatureDialog.roundProgressLabel", {
          position: round.position,
          total: round.size,
        })}
      </span>
    </Badge>
  ) : null;

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          initialFocus={initialFocus}
          className={cn("gap-0 p-0", SHEET_SURFACE)}
        >
          <SheetAppBar
            icon={<LeadingIcon className="size-5" />}
            label={leadingLabel}
            onPress={onLeading}
            title={title}
            subtitle={subtitle}
            trailing={counter}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3">
            {children}
          </div>

          <div className={SHEET_FOOTER}>{footer}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] w-full gap-5 overflow-y-auto sm:max-w-md"
        initialFocus={initialFocus}
      >
        <DialogHeader>
          {/* Dialog's own close button is absolutely positioned here — keep the row clear of it. */}
          <div className="flex items-start justify-between gap-3 pr-14">
            <div className="min-w-0">
              <DialogTitle className="truncate">{title}</DialogTitle>
              <DialogDescription className="truncate">
                {subtitle}
              </DialogDescription>
            </div>
            {counter}
          </div>
        </DialogHeader>

        {children}

        <DialogFooter className="gap-2 sm:w-full sm:justify-stretch sm:gap-3">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
