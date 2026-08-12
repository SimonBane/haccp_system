"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MobileListVariant = "row" | "card";

/**
 * An inset grouped list — one rounded surface, rows divided by hairlines that
 * start where the text starts rather than at the container edge.
 *
 * That inset is the whole difference between something that reads as a native
 * list and something that reads as a table with borders on a phone. The rule
 * itself lives in globals.css, keyed off the row's inner slot, because it has
 * to know where the leading element ends.
 *
 * `variant="card"` breaks the group apart into separate elevated cards instead,
 * for a page whose records need more than a title and one line under it. Same
 * component either way, so the two densities cannot drift.
 */
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
  /**
   * "row" is one line plus a subtitle, the density a list of names wants.
   * "card" gives the record room to breathe and unlocks `details`.
   */
  variant?: MobileListVariant;
  /** Avatar or icon. Also sets where the hairline above the row begins. */
  leading?: ReactNode;
  title: ReactNode;
  /** One line under the title — the secondary detail, not a label/value dump. */
  subtitle?: ReactNode;
  /** Right-aligned value or status. */
  trailing?: ReactNode;
  /** Card variant only: a free-form block under the title, allowed to wrap. */
  details?: ReactNode;
  className?: string;
};

/**
 * One record in the mobile list.
 *
 * Carries no controls of its own. A tap runs the row's primary action, a long
 * press opens every action, and a swipe-left reveals delete — all wired by
 * `DataTableCardList`, which is also what makes those three the same everywhere
 * instead of a kebab here and a chevron there.
 */
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
        // `border`, not `ring`: a ring paints outside the border box, and the
        // swipe wrapper this sits inside is `overflow: hidden`, which clipped
        // every straight edge and left just the four corner arcs.
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
        {/* flex-1 so `trailing` is pushed to the far edge rather than sitting
            immediately after the title. */}
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

/**
 * The button in a row's swipe-revealed tray.
 *
 * Full-bleed and full-height, the way native trays look — the tray is sized by
 * `SwipeableRow` and this fills it.
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
