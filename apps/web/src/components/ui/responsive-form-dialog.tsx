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

export const SHEET_SURFACE = [
  "top-8 h-[calc(100dvh-2rem)] max-h-none rounded-t-3xl border-t",
  // Unqualified so tailwind-merge beats the stock duration by name, not emit order.
  "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0",
].join(" ");

export const SHEET_FOOTER =
  "shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] [&_[data-slot=button]]:h-(--control-h)";

export function SheetAppBar({
  icon,
  label,
  onPress,
  title,
  subtitle,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
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
  footer?: React.ReactNode;
  closeLabel: string;
  className?: string;
  initialFocus?: boolean;
};

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
