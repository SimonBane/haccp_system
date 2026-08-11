"use client";

import { CheckIcon, XIcon } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** One choice behind the nav-bar submit icon, when there is more than one. */
export type ResponsiveFormSubmitOption = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

/** The submit action, shown as an icon button in the mobile nav bar. */
export type ResponsiveFormSubmit = {
  label: string;
  /** id of the `<form>` this submits, so the button can live outside it. */
  formId?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /**
   * When set, the icon opens a popover of these instead of submitting —
   * for forms that genuinely have two ways to finish, like save vs.
   * save-and-invite.
   */
  options?: ResponsiveFormSubmitOption[];
};

type ResponsiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Desktop footer. On mobile it is only used when there is no `submit`. */
  footer?: React.ReactNode;
  submit?: ResponsiveFormSubmit;
  closeLabel?: string;
  className?: string;
  initialFocus?: boolean;
  /**
   * How the form presents on a phone.
   *
   * "fullscreen" is the default for anything longer than a couple of fields: a
   * partial-height sheet leaves a long form scrolling inside a letterbox and
   * one careless swipe from dismissal. "sheet" suits a single-field edit.
   */
  mobileVariant?: "fullscreen" | "sheet";
};

const DISMISS_THRESHOLD_PX = 96;

/**
 * Slide the whole sheet up from the bottom, the way a native modal presents.
 *
 * Base UI's stock bottom-sheet transition only nudges 2.5rem, which on a
 * full-height form reads as a flicker rather than a transition.
 */
const SHEET_SLIDE =
  "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:translate-y-full data-ending-style:translate-y-full data-starting-style:opacity-100 data-ending-style:opacity-100";

/**
 * Drag-down-to-dismiss, from the grab handle only.
 *
 * Deliberately not from the sheet body: the body scrolls, and claiming drags
 * there is what makes web sheets feel like they are fighting you.
 */
function SheetGrabHandle({ onDismiss }: { onDismiss: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    const sheet = node?.closest<HTMLElement>('[data-slot="sheet-content"]');
    if (!node || !sheet) return;

    let startY: number | null = null;
    let offset = 0;
    let frame = 0;

    const write = () => {
      frame = 0;
      sheet.style.translate = `0 ${offset}px`;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      startY = event.clientY;
      sheet.style.transition = "none";
      node.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (startY === null) return;
      offset = Math.max(0, event.clientY - startY);
      if (!frame) frame = requestAnimationFrame(write);
    };

    const onPointerUp = () => {
      if (startY === null) return;
      const dismissed = offset > DISMISS_THRESHOLD_PX;
      startY = null;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      sheet.style.transition = "";
      sheet.style.translate = "";
      offset = 0;
      if (dismissed) onDismiss();
    };

    node.addEventListener("pointerdown", onPointerDown, { passive: true });
    node.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerup", onPointerUp, { passive: true });
    node.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointercancel", onPointerUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      // Generous hit area around a small visual handle — the standard trick
      // for making a 4px affordance actually grabbable with a thumb.
      className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1"
      aria-hidden
    >
      <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

/** The nav bar's submit affordance: one icon, or one icon plus a popover. */
function NavBarSubmit({ submit }: { submit: ResponsiveFormSubmit }) {
  const icon = submit.icon ?? <CheckIcon className="size-5" />;
  const busy =
    submit.isLoading || submit.options?.some((option) => option.isLoading);

  if (!submit.options?.length) {
    return (
      <Button
        type={submit.formId ? "submit" : "button"}
        form={submit.formId}
        size="icon-lg"
        aria-label={submit.label}
        isLoading={submit.isLoading}
        disabled={submit.disabled}
        onClick={submit.onClick}
        className="size-(--control-h) shrink-0"
      >
        {icon}
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="icon-lg"
            aria-label={submit.label}
            isLoading={busy}
            disabled={submit.disabled}
            className="size-(--control-h) shrink-0"
          />
        }
      >
        {icon}
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-auto gap-1 p-1">
        {submit.options.map((option) => (
          <Button
            key={option.label}
            type="button"
            variant="ghost"
            className="w-full justify-start"
            isLoading={option.isLoading}
            disabled={option.disabled}
            onClick={option.onClick}
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  submit,
  closeLabel,
  className,
  initialFocus,
  mobileVariant = "fullscreen",
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  if (isMobile && mobileVariant === "fullscreen") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            // Anchored below the notch rather than truly edge-to-edge, so the
            // rounded top actually reads as a sheet presented over the page.
            "inset-x-0 bottom-0 top-[max(0.75rem,env(safe-area-inset-top))]",
            "flex h-auto flex-col gap-0 rounded-t-2xl border-0 p-0",
            SHEET_SLIDE,
          )}
        >
          {/* X · Title · submit icon. No rule under it — the elevation change
              between chrome and content is enough separation. */}
          <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={closeLabel}
              className="size-(--control-h) shrink-0"
              onClick={close}
            >
              <XIcon className="size-5" />
            </Button>
            <SheetTitle className="min-w-0 flex-1 truncate text-center text-base">
              {title}
            </SheetTitle>
            {submit ? (
              <NavBarSubmit submit={submit} />
            ) : (
              // Balances the X so the title stays optically centred.
              <span className="size-10 shrink-0" aria-hidden />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
            {children}
          </div>

          {/* Only when the action did not move into the nav bar. */}
          {!submit && footer ? (
            <div className="shrink-0 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&_[data-slot=dialog-footer]]:flex-col [&_[data-slot=dialog-footer]]:gap-2 [&_button]:w-full [&_button]:min-h-11">
              {footer}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            "flex max-h-[94dvh] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 p-0",
            SHEET_SLIDE,
          )}
        >
          <SheetGrabHandle onDismiss={close} />
          <SheetHeader className="shrink-0 px-4 pt-2 pb-0 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&_[data-slot=dialog-footer]]:flex-col [&_[data-slot=dialog-footer]]:gap-2 [&_button]:w-full [&_button]:min-h-11">
              {footer}
            </div>
          ) : null}
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
