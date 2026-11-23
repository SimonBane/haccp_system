"use client";

import { CheckIcon, ChevronDownIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CARD_CLASS = "rounded-xl bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10";

/** Sizes match the title + description block beside each badge, so the badge reads as a square of the same height. */
const BADGE_SIZE = { section: "size-[46px]", mobile: "size-[38px]" } as const;

export function StepBadge({
  step,
  done,
  doneLabel,
  size,
}: {
  step: number;
  done: boolean;
  doneLabel: string;
  size: keyof typeof BADGE_SIZE;
}) {
  const base = cn(
    "flex shrink-0 items-center justify-center rounded-lg",
    BADGE_SIZE[size],
  );
  return done ? (
    <span role="img" aria-label={doneLabel} className={cn(base, "bg-success text-success-foreground")}>
      <CheckIcon className="size-4" />
    </span>
  ) : (
    <span className={cn(base, "bg-muted text-sm font-semibold")}>{step}</span>
  );
}

/** A numbered builder section on desktop; every section stays open so the whole task reads top to bottom. */
export function BuilderSection({
  id,
  step,
  done,
  doneLabel,
  title,
  titleExtra,
  description,
  action,
  children,
}: {
  id: string;
  step: number;
  done: boolean;
  doneLabel: string;
  title: string;
  titleExtra?: ReactNode;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(CARD_CLASS, "flex flex-col gap-5 p-6")}>
      <div className="flex items-center gap-3">
        <StepBadge step={step} done={done} doneLabel={doneLabel} size="section" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={id} className="text-base font-semibold">
              {title}
            </h2>
            {titleExtra}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="flex items-center">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A collapsible section on mobile: closed it shows a one-line summary, so one section is open at a time. */
export function MobileBuilderSection({
  id,
  step,
  done,
  doneLabel,
  title,
  titleExtra,
  summary,
  summaryInvalid,
  open,
  onToggle,
  children,
}: {
  id: string;
  step: number;
  done: boolean;
  doneLabel: string;
  title: string;
  titleExtra?: ReactNode;
  summary: string;
  summaryInvalid: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={CARD_CLASS}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <StepBadge step={step} done={done} doneLabel={doneLabel} size="mobile" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex h-5 items-center gap-2">
            <span className="text-[15px] leading-5 font-semibold">{title}</span>
            {titleExtra}
          </span>
          <span
            className={cn(
              "truncate text-[13px] leading-[18px]",
              summaryInvalid ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {summary}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-[18px] shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div id={`${id}-panel`} className="flex flex-col gap-4 px-4 pb-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** A titled part of a section card (days, times, opens, overdue), so each reads as its own step. */
export function SubPanel({
  icon: Icon,
  title,
  titleId,
  description,
  aside,
  compact = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  titleId?: string;
  description: string;
  aside?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card", compact ? "p-3" : "p-4")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card text-primary"
          >
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span id={titleId} className="text-sm font-semibold">
              {title}
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}
