"use client";

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * An inset grouped list — one rounded surface, rows divided by hairlines that
 * start where the text starts rather than at the container edge.
 *
 * That inset is the whole difference between something that reads as a native
 * list and something that reads as a table with borders on a phone. The rule
 * itself lives in globals.css, keyed off the row's inner slot, because it has
 * to know where the leading element ends.
 */
export function MobileList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="mobile-list"
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Sticky group header, iOS-style: sits above its rows and pins while they scroll. */
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
  /** Avatar or icon. Also sets where the hairline above the row begins. */
  leading?: ReactNode;
  title: ReactNode;
  /** One line under the title — the secondary detail, not a label/value dump. */
  subtitle?: ReactNode;
  /** Right-aligned value or status, before the chevron. */
  trailing?: ReactNode;
  /** Overflow menu. Kept as the accessible equivalent of the swipe actions. */
  actions?: ReactNode;
  showChevron?: boolean;
  className?: string;
};

export function MobileListRow({
  leading,
  title,
  subtitle,
  trailing,
  actions,
  showChevron = true,
  className,
}: MobileListRowProps) {
  return (
    <div
      data-slot="mobile-list-row"
      className={cn(
        "flex items-stretch bg-card ps-4 transition-colors active:bg-muted/60",
        className,
      )}
    >
      {leading ? (
        <div className="flex shrink-0 items-center pe-3">{leading}</div>
      ) : null}

      <div
        data-slot="mobile-list-row-inner"
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pe-2"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] leading-tight font-medium">
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

        {actions ? (
          <div
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}

        {showChevron ? (
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground/60"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * A button in a row's swipe-revealed action tray.
 *
 * Full-bleed and full-height, the way native trays look — the tray is sized by
 * `SwipeableRow`, and these divide it between them.
 */
export function MobileListSwipeAction({
  label,
  icon,
  onClick,
  variant = "default",
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 px-3 text-xs font-medium",
        variant === "destructive"
          ? "bg-destructive text-white"
          : "bg-muted text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Compact status pill for a row's `trailing` slot. */
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
