"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MobileListVariant = "row" | "card";

export function MobileList({
  children,
  variant = "row",
  className,
}: {
  children: ReactNode;
  variant?: MobileListVariant;
  className?: string;
}) {
  return (
    <div
      data-slot="mobile-list"
      data-variant={variant}
      className={cn(
        variant === "card"
          ? "flex flex-col gap-2"
          : "overflow-hidden rounded-xl bg-card ring-1 ring-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MobileListSectionHeader({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="mobile-list-section"
      className="sticky top-0 z-10 bg-muted/80 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur-sm"
    >
      {children}
    </div>
  );
}

export type MobileListRowProps = {
  variant?: MobileListVariant;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  details?: ReactNode;
  className?: string;
};

export function MobileListRow({
  variant = "row",
  leading,
  title,
  subtitle,
  trailing,
  details,
  className,
}: MobileListRowProps) {
  const isCard = variant === "card";

  return (
    <div
      data-slot="mobile-list-row"
      data-variant={variant}
      className={cn(
        "flex items-stretch bg-card transition-colors active:bg-muted/60",
        isCard ? "rounded-xl border border-border p-4" : "ps-4",
        className,
      )}
    >
      {leading ? (
        <div className="flex shrink-0 items-start pe-3 [[data-variant=row]>&]:items-center">
          {leading}
        </div>
      ) : null}

      <div
        data-slot="mobile-list-row-inner"
        className={cn(
          "flex min-w-0 flex-1 gap-3",
          isCard ? "flex-col" : "items-center py-3 pe-2",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 gap-3",
            isCard ? "items-start" : "items-center",
          )}
        >
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate font-medium",
                isCard ? "text-base leading-snug" : "text-[15px] leading-tight",
              )}
            >
              {title}
            </div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-[13px] leading-tight text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>

          {trailing ? (
            <div className="shrink-0 text-[13px] text-muted-foreground">
              {trailing}
            </div>
          ) : null}
        </div>

        {isCard && details ? <div className="min-w-0">{details}</div> : null}
      </div>
    </div>
  );
}

export function MobileListBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("inline-flex items-center gap-1 text-xs", className)}
    >
      {children}
    </Badge>
  );
}
