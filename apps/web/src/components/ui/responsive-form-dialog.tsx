"use client";

import { XIcon } from "lucide-react";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { handOffKeyboard } from "@/lib/keyboard-primer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/** One button in the mobile form's bottom action bar. */
export type ResponsiveFormAction = {
  label: string;
  icon?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  /** id of the `<form>` this submits, so the button can live outside it. */
  formId?: string;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export type ResponsiveFormActions = {
  /**
   * "stack" gives each action a full-width row — the default, and right for one
   * action or for two of unequal weight. "split" divides the bar evenly, which
   * is what two peers want: save vs. save-and-invite, neither subordinate.
   */
  layout?: "stack" | "split";
  items: ResponsiveFormAction[];
};

/** The field to land on when the form opens, and what to do with its value. */
export type ResponsiveFormAutoFocus = {
  ref: React.RefObject<HTMLInputElement | null>;
  /** "select" for an edit — the value is a starting point, not a prefix. */
  selection?: "select" | "end" | "none";
};

type ResponsiveFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Desktop footer. Mobile uses `actions`. */
  footer?: React.ReactNode;
  /** The mobile action bar, pinned to the bottom above the keyboard. */
  actions?: ResponsiveFormActions;
  closeLabel?: string;
  className?: string;
  /** Desktop only. Mobile focus is `autoFocusField`. */
  initialFocus?: boolean;
  /**
   * Pair with `primeKeyboard()` in the control that opens this form, or on iOS
   * the field focuses silently with no keyboard.
   */
  autoFocusField?: ResponsiveFormAutoFocus;
};

/**
 * Slide the whole sheet up from the bottom, the way a native modal presents.
 *
 * Every translate here is qualified with `data-[side=bottom]:`, and that is
 * load-bearing rather than decorative. The stock sheet ships
 * `data-[side=bottom]:data-ending-style:translate-y-[2.5rem]`, which carries one
 * more variant than a bare `data-ending-style:translate-y-full` and therefore
 * wins on specificity — tailwind-merge cannot collapse the pair either, since
 * the variant prefixes differ. That is what made the sheet drop 40px, sit there
 * for the duration, and then vanish instead of sliding out.
 */
export const SHEET_SLIDE =
  "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full data-starting-style:opacity-100 data-ending-style:opacity-100 motion-reduce:duration-0";

function FormActionBar({ actions }: { actions: ResponsiveFormActions }) {
  const split = actions.layout === "split";

  return (
    <div
      data-slot="form-action-bar"
      className={cn(
        // No rule above it: the bar is part of the form, not chrome bolted to
        // the bottom of it.
        "flex shrink-0 gap-2 bg-background px-4 pt-3",
        // When the keyboard is up the home indicator is behind it, so the calc
        // goes negative and max() falls back to the plain 12px gutter — no dead
        // band between the keys and the buttons.
        "pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))]",
        split ? "flex-row" : "flex-col",
      )}
    >
      {actions.items.map((action) => (
        <Button
          key={action.label}
          type={action.formId ? "submit" : "button"}
          form={action.formId}
          variant={action.variant}
          isLoading={action.isLoading}
          disabled={action.disabled}
          onClick={action.onClick}
          className={cn("min-h-12 text-base", split ? "flex-1" : "w-full")}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * One form surface, two presentations.
 *
 * On a phone it is always the whole screen: a partial-height sheet leaves a form
 * scrolling inside a letterbox, one careless swipe from dismissal, and made the
 * app feel like it had two kinds of form for no reason a user could name. The
 * actions live in a bar pinned to the bottom, which the sheet lifts clear of the
 * software keyboard — see the `[data-side=bottom]` rule in globals.css.
 *
 * On desktop it stays a centred dialog with a conventional footer.
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  actions,
  closeLabel,
  className,
  initialFocus,
  autoFocusField,
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  // A function rather than a ref: Base UI's default resolver deliberately
  // focuses the popup itself on a touch interaction, to *suppress* the
  // keyboard. Returning false says focus has been placed already, which also
  // stops Base UI taking it back.
  //
  // Not memoised — Base UI reads it once when the popup opens, so a new
  // identity per render costs nothing and keeps it off the stale-closure path.
  const resolveSheetFocus = () => {
    const node = autoFocusField?.ref.current;
    if (!node) return true;
    handOffKeyboard(node, autoFocusField?.selection ?? "none");
    return false;
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          initialFocus={resolveSheetFocus}
          className={cn(
            // Edge to edge and square: this is the screen now, not a card laid
            // over it. The safe area is padding on the nav bar, so the bar's
            // own background reaches under the notch.
            "inset-x-0 top-0 flex h-auto flex-col gap-0 rounded-none border-0 p-0",
            SHEET_SLIDE,
          )}
        >
          {/* X · Title. No rule under it — the elevation change between chrome
              and content is enough separation, and the commit action belongs
              under the thumb, not in the far corner. */}
          <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
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
            {/* Balances the X so the title stays optically centred. */}
            <span className="size-(--control-h) shrink-0" aria-hidden />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
            {children}
          </div>

          {actions?.items.length ? <FormActionBar actions={actions} /> : null}
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
