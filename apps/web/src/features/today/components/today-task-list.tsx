"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TodaySection } from "./today-section";
import type { GroupedTodayTasks, TodayUiBucket } from "../lib/today-grouping";

type Props = {
  grouped: GroupedTodayTasks;
  totalCount: number;
  completedCount: number;
  now: Date;
  pendingKey: string | null;
  currentUserId: string | null;
  onComplete: (task: TodayTaskItem) => void;
  onUndo: (task: TodayTaskItem) => void;
  onRecordTemperature: (task: TodayTaskItem) => void;
};

const SECTION_ORDER: {
  key: keyof GroupedTodayTasks;
  bucket: TodayUiBucket;
  titleKey: "attention" | "overdue" | "now" | "next" | "completed";
}[] = [
  { key: "attention", bucket: "attention", titleKey: "attention" },
  { key: "overdue", bucket: "overdue", titleKey: "overdue" },
  { key: "dueNow", bucket: "dueNow", titleKey: "now" },
  { key: "upcoming", bucket: "upcoming", titleKey: "next" },
  { key: "completed", bucket: "completed", titleKey: "completed" },
];

export function TodayTaskList({
  grouped,
  totalCount,
  completedCount,
  now,
  pendingKey,
  currentUserId,
  onComplete,
  onUndo,
  onRecordTemperature,
}: Props) {
  const t = useTranslations("TodayPage");
  const allCompleted = totalCount > 0 && completedCount === totalCount;
  const hasVisibleActionableTasks =
    grouped.attention.length > 0 ||
    grouped.overdue.length > 0 ||
    grouped.dueNow.length > 0 ||
    grouped.upcoming.length > 0;

  return (
    <div className="space-y-6">
      {allCompleted && (
        <Alert className="bg-muted/30">
          <CheckCircle2Icon aria-hidden />
          <AlertTitle>{t("progress.allCompletedTitle")}</AlertTitle>
          <AlertDescription>
            {t("progress.allCompletedSummary", {
              completed: completedCount,
              total: totalCount,
            })}
          </AlertDescription>
        </Alert>
      )}

      {SECTION_ORDER.map((section) => {
        const tasks = grouped[section.key];
        if (tasks.length === 0) return null;

        return (
          <TodaySection
            key={section.key}
            title={t(`sections.${section.titleKey}`)}
            count={tasks.length}
            bucket={section.bucket}
            tasks={tasks}
            now={now}
            pendingKey={pendingKey}
            currentUserId={currentUserId}
            defaultOpen={
              section.bucket !== "completed" || !hasVisibleActionableTasks
            }
            onComplete={onComplete}
            onUndo={onUndo}
            onRecordTemperature={onRecordTemperature}
          />
        );
      })}
    </div>
  );
}
