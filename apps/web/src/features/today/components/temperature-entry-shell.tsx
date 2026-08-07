"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
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
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** "back" once the flow has a previous step to return to. */
  leading: "close" | "back";
  leadingLabel: string;
  onLeading: () => void;
  primaryIcon: "continue" | "confirm";
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryLoading: boolean;
  onPrimary: () => void;
  /** Desktop only — mobile opens on its own keypad and needs no focus ring. */
  desktopInitialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

/**
 * The surface a temperature reading is entered on.
 *
 * On a phone it is a full-screen modal that slides up from the bottom: the modal
 * is exactly the viewport, so its height cannot change while the worker types,
 * and the commit action sits in the top-right corner — as far as possible from
 * the keypad that owns the bottom of the screen.
 *
 * On desktop it stays a conventional centred dialog with a footer button; a
 * mouse does not mis-tap.
 *
 * Deliberately not built on ResponsiveFormDialog: full-screen, a custom app bar
 * and no footer would need three new props and a third height variant on a
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
  primaryIcon,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  onPrimary,
  desktopInitialFocus,
  children,
}: Props) {
  const isMobile = useIsMobile();
  const LeadingIcon = leading === "close" ? XIcon : ArrowLeftIcon;
  const PrimaryIcon = primaryIcon === "confirm" ? CheckIcon : ArrowRightIcon;

  if (isMobile) {
    const appBarIconButton =
      "size-11 rounded-full border-border bg-background shadow-sm";

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          // The close control moves into the app bar; this slot is the primary action.
          showCloseButton={false}
          className={cn(
            // Variant-qualified, because the stock side=bottom rule is h-auto
            // and would otherwise win on specificity.
            "data-[side=bottom]:h-[100dvh] max-h-none gap-0 rounded-none border-0 p-0",
            // The stock bottom sheet nudges 2.5rem and fades. Across a full
            // screen that reads as a flicker rather than a slide.
            "duration-300 data-starting-style:opacity-100 data-ending-style:opacity-100",
            "data-[side=bottom]:data-starting-style:translate-y-full",
            "data-[side=bottom]:data-ending-style:translate-y-full",
            "motion-reduce:duration-0",
          )}
        >
          <header className="grid h-14 shrink-0 grid-cols-[3rem_1fr_3rem] items-center px-2 pt-[env(safe-area-inset-top)]">
            <Button
              variant="outline"
              size="icon"
              className={cn(appBarIconButton, "justify-self-start")}
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

            <Button
              variant="outline"
              size="icon"
              className={cn(
                appBarIconButton,
                "justify-self-end",
                primaryDisabled
                  ? "text-muted-foreground"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground",
              )}
              // The icon carries no text on mobile, so the label is its only name.
              aria-label={primaryLabel}
              disabled={primaryDisabled}
              isLoading={primaryLoading}
              onClick={onPrimary}
            >
              <PrimaryIcon className="size-5" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] w-full gap-5 overflow-y-auto sm:max-w-md"
        initialFocus={desktopInitialFocus}
      >
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription className="truncate">{subtitle}</DialogDescription>
        </DialogHeader>

        {children}

        <DialogFooter className="gap-2 sm:gap-2">
          {leading === "back" ? (
            <Button variant="ghost" onClick={onLeading}>
              <ArrowLeftIcon data-icon="inline-start" />
              {leadingLabel}
            </Button>
          ) : null}
          <Button
            disabled={primaryDisabled}
            isLoading={primaryLoading}
            onClick={onPrimary}
          >
            {primaryLabel}
            <PrimaryIcon data-icon="inline-end" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
