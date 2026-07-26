"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { Clock3Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { occurrenceKey } from "../lib/today-grouping";

type Props = {
  task: TodayTaskItem | null;
  pendingKey: string | null;
  onComplete: (task: TodayTaskItem) => void;
  onRecordTemperature: (task: TodayTaskItem) => void;
};

export function TodayPriorityBanner({
  task,
  pendingKey,
  onComplete,
  onRecordTemperature,
}: Props) {
  const t = useTranslations("TodayPage");

  if (!task) return null;
  const currentTask = task;

  function handleAction() {
    if (currentTask.type === "temperature") {
      onRecordTemperature(currentTask);
      return;
    }
    onComplete(currentTask);
  }

  return (
    <Card className="gap-0 px-3.5 py-3 shadow-xs lg:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock3Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("overview.nextPriority")}
              </div>
              <Badge
                variant={
                  currentTask.status === "overdue" ? "destructive" : "outline"
                }
                className="shrink-0 tabular-nums"
              >
                {currentTask.scheduledTime}
              </Badge>
            </div>
            <div className="mt-1 truncate text-sm font-medium">
              {currentTask.title}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {currentTask.equipmentName ?? t(`taskTypes.${currentTask.type}`)}
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto sm:min-w-28"
          isLoading={pendingKey === occurrenceKey(currentTask)}
          onClick={handleAction}
        >
          {currentTask.type === "temperature"
            ? t("actions.record")
            : t("actions.complete")}
        </Button>
      </div>
    </Card>
  );
}
