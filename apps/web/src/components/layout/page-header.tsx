"use client";

import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  MobileHeaderActions,
  MobileHeaderTitle,
} from "@/components/layout/shell-slots";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** The page's primary action. Inline on desktop, in the top bar on mobile. */
  actions?: ReactNode;
  className?: string;
};

/**
 * Title, description and primary action for a page — and the top of every page
 * on desktop, now that the breadcrumb bar above it is gone.
 *
 * On mobile nothing renders inline: the title and actions are portalled into
 * the shared top bar, so the page starts at its content instead of repeating a
 * heading the chrome is already showing.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        <MobileHeaderTitle>{title}</MobileHeaderTitle>
        {actions ? <MobileHeaderActions>{actions}</MobileHeaderActions> : null}
      </>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/**
 * The mobile "add" affordance: an icon button in the shared top bar.
 *
 * Mobile only, and it portals itself — on desktop the same action lives on the
 * grid's toolbar row next to the search field, which is where the eye already
 * is when you are looking at a list.
 */
export function MobileHeaderAddAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <MobileHeaderActions>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0 rounded-lg border-sidebar-border bg-transparent text-foreground shadow-none hover:bg-transparent"
        aria-label={label}
        onClick={onClick}
      >
        <PlusIcon className="size-5" />
      </Button>
    </MobileHeaderActions>
  );
}
