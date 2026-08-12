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
import { SHEET_SLIDE } from "@/components/ui/responsive-form-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { handOffKeyboard } from "@/lib/keyboard-primer";
import { cn } from "@/lib/utils";

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
 * On a phone it is a full-screen modal that slides up from the bottom and then
 * shortens to whatever the software keyboard leaves — see the `[data-side=bottom]`
 * rule in globals.css. The commit action rides that bottom edge, so it ends up
 * directly on top of the keys; that is what freed the app bar's trailing slot for
 * the round counter.
 *
 * On desktop it stays a conventional centred dialog with a footer; a mouse does
 * not mis-tap, and the keyboard never leaves the number field.
 *
 * It is mounted once per round and deliberately never remounted between checks:
 * remounting would replay the slide-up on every advance. Only the entry state
 * inside it resets.
 *
 * Deliberately not built on ResponsiveFormDialog: full-screen, a custom app bar
 * and a custom action bar would need new props and a third height variant on a
 * component four admin forms depend on.
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
          // Base UI's default resolver focuses the popup itself on a touch
          // interaction, precisely to keep the keyboard down. Here the keyboard
          // is the point, so put focus on the reading field and select what is
          // in it — a retype then overwrites rather than appends.
          initialFocus={() => {
            const node = initialFocus?.current;
            if (!node) return true;
            handOffKeyboard(node, "select");
            return false;
          }}
          className={cn(
            // top-0 with h-auto rather than a fixed 100dvh: the shell's own
            // `bottom` is driven by --keyboard-inset, and a resolved height
            // would make the popup overflow the top by the keyboard's height
            // instead of getting shorter.
            "top-0 data-[side=bottom]:h-auto max-h-none gap-0 rounded-none border-0 p-0",
            // The same slide every other form uses, from the same constant, so
            // the two surfaces cannot drift apart.
            SHEET_SLIDE,
          )}
        >
          {/* The height has to include the inset. Tailwind's preflight makes
              every box border-box, so a bare h-14 with a safe-area top padding
              leaves a notched iPhone about 9px of actual app bar. */}
          <header className="grid h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 bg-popover px-2 pt-[env(safe-area-inset-top)]">
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

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
            {children}
          </div>

          {/* Sits directly on top of the software keyboard: the sheet shortens
              by --keyboard-inset, and the home-indicator gutter collapses when
              the keyboard is already covering it. */}
          <div className="shrink-0 bg-popover px-4 pt-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))]">
            {footer}
          </div>
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
