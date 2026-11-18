"use client";

import { XIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MobileFormSheet,
  type ResponsiveFormSurfaceProps,
} from "@/components/ui/responsive-form-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Prefixed with the side variant so they outrank the stock `data-[side=right]:sm:max-w-sm`.
const SIZE_CLASS = {
  md: "data-[side=right]:sm:max-w-md",
  lg: "data-[side=right]:sm:max-w-lg",
  xl: "data-[side=right]:sm:max-w-xl",
} as const;

type ResponsiveFormSheetProps = ResponsiveFormSurfaceProps & {
  size?: keyof typeof SIZE_CLASS;
};

/** Drop-in for `ResponsiveFormDialog` when a form is too long for a centred modal. */
export function ResponsiveFormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  className,
  initialFocus,
  size = "lg",
}: ResponsiveFormSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileFormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        footer={footer}
        closeLabel={closeLabel}
        className={className}
      >
        {children}
      </MobileFormSheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={initialFocus}
        className={cn(
          "gap-0 overflow-hidden rounded-xl p-0 ring-1 ring-foreground/10",
          // Floats with the same gap as the app's inset content panel instead of touching the edges.
          "data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:border-l-0",
          SIZE_CLASS[size],
          className,
        )}
      >
        <SheetHeader className="shrink-0 flex-row items-start gap-3 border-b px-6 py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </div>
          <SheetClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={closeLabel}
                className="-mt-1 -mr-2 shrink-0"
              />
            }
          >
            <XIcon />
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t px-6 py-4">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
