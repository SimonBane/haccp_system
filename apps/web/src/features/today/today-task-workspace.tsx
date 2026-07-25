"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { TodayFilters } from "./today-filters";
import type {
  GroupedTodayTasks,
  TodayFilter,
  TodayFilterCounts,
} from "./today-grouping";
import { TodayTaskList } from "./today-task-list";

type Props = {
  filter: TodayFilter;
  counts: TodayFilterCounts;
  grouped: GroupedTodayTasks;
  totalCount: number;
  completedCount: number;
  now: Date;
  pendingKey: string | null;
  currentUserId: string | null;
  onFilterChange: (filter: TodayFilter) => void;
  onComplete: (task: TodayTaskItem) => void;
  onUndo: (task: TodayTaskItem) => void;
  onRecordTemperature: (task: TodayTaskItem) => void;
};

export function TodayTaskWorkspace({
  filter,
  counts,
  grouped,
  totalCount,
  completedCount,
  now,
  pendingKey,
  currentUserId,
  onFilterChange,
  onComplete,
  onUndo,
  onRecordTemperature,
}: Props) {
  const t = useTranslations("TodayPage");

  return (
    <section className="min-w-0 space-y-5">
      <div className="hidden md:block">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("workspace.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("workspace.description")}
        </p>
      </div>

      <TodayFilters value={filter} onChange={onFilterChange} counts={counts} />

      <TodayTaskList
        grouped={grouped}
        totalCount={totalCount}
        completedCount={completedCount}
        now={now}
        pendingKey={pendingKey}
        currentUserId={currentUserId}
        onComplete={onComplete}
        onUndo={onUndo}
        onRecordTemperature={onRecordTemperature}
      />
    </section>
  );
}
