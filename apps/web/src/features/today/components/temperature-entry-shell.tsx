"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  /** Kept mounted while false so the exit transition can run. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** "back" once the flow has a previous step to return to. */
  leading: "close" | "back";
  leadingLabel: string;
  onLeading: () => void;
  /** Null for a lone check, which then looks exactly like the old flow. */
  round: { position: number; size: number } | null;
  footer: ReactNode;
  /** The reading field, focused on open so the keyboard comes straight up. */
  initialFocus?: RefObject<HTMLInputElement | null>;
  children: ReactNode;
};

/**
 * The surface a round of temperature readings is entered on.
 *
 * A bottom sheet on a phone, a centred dialog from `md` up. Both are sized to
 * their content; the browser handles the software keyboard.
 *
 * It is mounted once per round and deliberately never remounted between checks:
 * remounting would replay the slide-up on every advance. Only the entry state
 * inside it resets.
 *
 * Deliberately not built on ResponsiveFormDialog: the app bar carries a back
 * control and the round counter, which that component has no slot for.
 */
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

  // The spoken and the shown forms are separate elements rather than an
  // aria-label on the badge: a label on a plain span is unreliably announced,
  // and "2 / 5" read literally is "two slash five".
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
          // The close control lives in the app bar instead.
          showCloseButton={false}
          initialFocus={initialFocus}
          className="max-h-[90dvh] gap-0 rounded-t-xl border-t p-0"
        >
          <header className="grid h-14 shrink-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 bg-popover px-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 justify-self-start rounded-full"
              aria-label={leadingLabel}
              onClick={onLeading}
            >
              <LeadingIcon className="size-5" />
            </Button>

            <div className="min-w-0 text-center">
              <SheetTitle className="truncate text-base">{title}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {subtitle}
              </SheetDescription>
            </div>

            {/* Matches the leading button's width so the title stays optically
                centred on a lone check, where there is no counter. */}
            {counter ?? <span className="w-11" aria-hidden />}
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3">
            {children}
          </div>

          <div className="shrink-0 bg-popover px-4 pt-3 pb-3">{footer}</div>
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
          {/* Dialog's own close button is absolutely positioned in this corner,
              so the row has to keep clear of it or the counter lands on top. */}
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

        {/* Centered rather than the stock end-aligned footer: end-alignment
            paired with the hint's now-removed left push used to leave the
            hint pinned to the far edge and the buttons hugging the other,
            never reading as one row. */}
        <DialogFooter className="gap-2 sm:w-full sm:justify-stretch sm:gap-3">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
