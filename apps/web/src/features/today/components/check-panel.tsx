"use client";

import { ArrowLeftIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  SHEET_SURFACE,
  SheetAppBar,
} from "@/components/ui/responsive-form-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { StatusTile, type TileTone } from "./status-tile";

/** Sized to a form plus the card's padding; the list beside it takes the rest. */
export const PANEL_COLUMN_CLASS = "xl:w-[min(40rem,58%)] xl:flex-none";

export type PanelHeading = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: TileTone;
  badge?: ReactNode;
};

type Props = {
  /** A sheet over the list on a phone, a card beside it from md. */
  mode: "sheet" | "card";
  /** Sheet only: kept mounted while false so the exit transition can run. */
  open: boolean;
  heading: PanelHeading | null;
  backLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function CheckPanel({
  mode,
  open,
  heading,
  backLabel,
  onClose,
  children,
}: Props) {
  if (mode === "sheet") {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn("gap-0 p-0", SHEET_SURFACE)}
        >
          <SheetAppBar
            icon={<ArrowLeftIcon className="size-5" />}
            label={backLabel}
            onPress={onClose}
            title={heading?.title ?? ""}
            subtitle={heading?.subtitle}
            trailing={heading?.badge}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-label={heading?.title}
      className="flex flex-col gap-5 rounded-2xl bg-card p-6 shadow-lg ring-1 ring-foreground/10"
      data-testid="check-panel"
    >
      {heading ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusTile icon={heading.icon} tone={heading.tone} size="lg" />
          <div className="min-w-0 flex-[1_1_15rem]">
            <h2 className="text-xl font-semibold tracking-tight">
              {heading.title}
            </h2>
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {heading.subtitle}
            </p>
          </div>
          {heading.badge}
        </div>
      ) : null}
      {children}
    </aside>
  );
}
