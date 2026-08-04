"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { Clock3Icon, ThermometerIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TodayUiBucket } from "../lib/today-grouping";

export type TaskMetaSegment = {
  key: string;
  node: ReactNode;
  /** Allowed to shrink and truncate when the row runs out of space. */
  shrink?: boolean;
  /** Dropped on narrow screens, where the row has little space next to the action button. */
  hideOnMobile?: boolean;
};

type Props = {
  task: TodayTaskItem;
  bucket: TodayUiBucket;
  meta: TaskMetaSegment[];
  exception?: ReactNode;
  actionLabel: string;
  actionVariant: "default" | "outline";
  isPending: boolean;
  onAction: () => void;
};

function iconBoxClass(bucket: TodayUiBucket): string {
  if (bucket === "attention" || bucket === "overdue") {
    return "bg-destructive/10 text-destructive";
  }
  return "bg-primary/10 text-primary";
}

export function TodayTaskRow({
  task,
  bucket,
  meta,
  exception,
  actionLabel,
  actionVariant,
  isPending,
  onAction,
}: Props) {
  return (
    <Card
      className={cn(
        "gap-0 px-3.5 py-3 shadow-xs transition-all hover:bg-muted/20 active:scale-[0.99] sm:px-4 sm:py-3.5",
        bucket === "completed" && "bg-muted/10",
      )}
    >
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            iconBoxClass(bucket),
          )}
        >
          {task.type === "temperature" ? (
            <ThermometerIcon className="size-5" aria-hidden />
          ) : (
            <Clock3Icon className="size-5" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-sm font-medium",
              bucket === "completed" && "text-foreground/80",
            )}
          >
            {task.title}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
            {meta.map((segment, index) => (
              <span
                key={segment.key}
                className={cn(
                  "flex items-center gap-1.5",
                  segment.shrink ? "min-w-0" : "shrink-0",
                  segment.hideOnMobile && "hidden sm:flex",
                )}
              >
                {index > 0 && (
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                )}
                {segment.node}
              </span>
            ))}
          </div>
          {exception ? <div className="mt-1.5">{exception}</div> : null}
        </div>

        <Button
          type="button"
          variant={actionVariant}
          size="sm"
          className={cn(
            "h-10 shrink-0 self-center px-3 sm:h-9 sm:min-w-28",
            actionVariant === "outline" &&
              "text-muted-foreground hover:text-foreground",
          )}
          isLoading={isPending}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
