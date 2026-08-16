"use client";

import { XIcon } from "lucide-react";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * The mobile sheet surface, shared with the Today temperature flow so the two
 * cannot drift apart.
 *
 * Full height rather than sized to content: a short form otherwise put its
 * commit action halfway up the screen, and the height then changed with every
 * form. The 2rem inset is what makes the top rounding read as a sheet laid over
 * the page instead of a new screen.
 *
 * The slide distance itself lives in `sheet.tsx`, on the `bottom` side, because
 * a surface this tall cannot rise the stock `2.5rem` without reading as a pop.
 * Overriding it from here instead would leave two competing
 * `[data-side=bottom][data-starting-style]` rules of *identical* specificity,
 * decided only by Tailwind's emit order — and tailwind-merge cannot collapse
 * that pair either, since the variants match and only the value differs.
 */
export const SHEET_SURFACE = [
  "top-8 h-[calc(100dvh-2rem)] max-h-none rounded-t-3xl border-t",
  // Unqualified utilities, so tailwind-merge resolves these against the stock
  // duration deterministically rather than by emit order.
  "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0",
].join(" ");

/**
 * Form controls and the buttons that submit them are the same height — the
 * `Button` component keeps one unqualified height precisely so a shell like
 * this can size them without the override leaking into layout buttons.
 */
export const SHEET_FOOTER =
  "shrink-0 px-4 py-3 [&_[data-slot=button]]:h-(--control-h)";

/**
 * The bar across the top of every mobile sheet.
 *
 * Leading control, optically centred title, optional trailing slot — the shape
 * a phone expects, and the reason the commit action is free to live at the
 * bottom under the thumb rather than in a far corner.
 *
 * It owns the `SheetTitle` / `SheetDescription` wrappers rather than taking
 * them as nodes, so the two surfaces using it cannot drift on type scale or
 * truncation.
 */
export function SheetAppBar({
  icon,
  label,
  onPress,
  title,
  subtitle,
  trailing,
}: {
  /** Usually a close X; the temperature flow swaps in a back arrow. */
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    // No background of its own: the sheet already paints one, and an opaque
    // square-cornered box here would cover its rounded top.
    <header className="grid h-14 shrink-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 px-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        className="size-11 justify-self-start rounded-full"
        onClick={onPress}
      >
        {icon}
      </Button>

      <div className="min-w-0 text-center">
        <SheetTitle className="truncate text-base">{title}</SheetTitle>
        {subtitle ? (
          <SheetDescription className="truncate text-xs">
            {subtitle}
          </SheetDescription>
        ) : null}
      </div>

      {/* Balances the leading button so the title stays optically centred when
          there is nothing trailing. */}
      {trailing ?? <span className="w-11" aria-hidden />}
    </header>
  );
}

type ResponsiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Shared by both presentations. */
  footer?: React.ReactNode;
  /** Names the mobile app bar's close control. */
  closeLabel: string;
  className?: string;
  initialFocus?: boolean;
};

/**
 * One form surface, two presentations: a bottom sheet on a phone, a centred
 * dialog from `md` up.
 *
 * Both are sized to their content and let the browser handle the software
 * keyboard — the body scrolls, the page scrolls it into view, and nothing here
 * measures the viewport.
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  className,
  initialFocus,
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn("gap-0 p-0", SHEET_SURFACE, className)}
        >
          <SheetAppBar
            icon={<XIcon className="size-5" />}
            label={closeLabel}
            onPress={() => onOpenChange(false)}
            title={title}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {children}
          </div>

          {footer ? <div className={SHEET_FOOTER}>{footer}</div> : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] w-full overflow-y-auto py-8 sm:max-w-md",
          className,
        )}
        initialFocus={initialFocus}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
