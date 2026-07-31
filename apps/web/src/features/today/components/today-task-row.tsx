"use client";

import type { TodayTaskItem } from "@haccp/shared";
import type { LucideIcon } from "lucide-react";
import { Clock3Icon, ThermometerIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TodayUiBucket } from "../lib/today-grouping";

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

type Props = {
  task: TodayTaskItem;
  bucket: TodayUiBucket;
  statusLabel: string;
  timeBadgeVariant: BadgeVariant;
  subtitle: string;
  actionLabel: string;
  actionVariant: "default" | "outline";
  isPending: boolean;
  onAction: () => void;
  secondary?: ReactNode;
};

function taskIcon(task: TodayTaskItem): LucideIcon {
  return task.type === "temperature" ? ThermometerIcon : Clock3Icon;
}

function iconBoxClass(bucket: TodayUiBucket): string {
  if (bucket === "attention" || bucket === "overdue") {
    return "bg-destructive/10 text-destructive";
  }
  if (bucket === "dueNow") {
    return "bg-primary/10 text-primary";
  }
  return "bg-primary/10 text-primary";
}

export function TodayTaskRow({
  task,
  bucket,
  statusLabel,
  timeBadgeVariant,
  subtitle,
  actionLabel,
  actionVariant,
  isPending,
  onAction,
  secondary,
}: Props) {
  const Icon = taskIcon(task);

  return (
    <Card
      className={cn(
        "gap-0 px-3.5 py-3 shadow-xs transition-transform active:scale-[0.99]",
        bucket === "completed" && "bg-muted/10",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              iconBoxClass(bucket),
            )}
          >
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {statusLabel}
              </div>
              <Badge
                variant={timeBadgeVariant}
                className="shrink-0 tabular-nums"
              >
                {task.scheduledTime}
              </Badge>
            </div>
            <div
              className={cn(
                "mt-1 truncate text-sm font-medium",
                bucket === "completed" && "text-foreground/80",
              )}
            >
              {task.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
            {secondary ? <div className="mt-1.5 space-y-1.5">{secondary}</div> : null}
          </div>
        </div>
        <Button
          type="button"
          variant={actionVariant}
          size="sm"
          className={cn(
            "h-11 w-full sm:h-9 sm:w-auto sm:min-w-28",
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
