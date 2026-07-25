"use client";

import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { computeTodayTaskStatus } from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TemperatureCheckDialog } from "./temperature-check-dialog";
import { TodayEmptyState } from "./today-empty-state";
import {
  applyTodayFilter,
  filterCountsFromGrouped,
  flatTodayTasks,
  groupTodayTasks,
  nextActionableTask,
  occurrenceKey,
  type TodayFilter,
} from "./today-grouping";
import { TodayHeader } from "./today-header";
import { TodayOverview } from "./today-overview";
import { TodayPageSkeleton } from "./today-page-skeleton";
import { TodayPriorityBanner } from "./today-priority-banner";
import { TodaySummary } from "./today-summary";
import { TodayTaskWorkspace } from "./today-task-workspace";
import { TodayWorkspace } from "./today-workspace";
import { useTodayApi } from "./use-today-api";

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day);
}

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: string, days: number): string {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  return formatLocalIsoDate(shifted);
}

function formatDate(dateStr: string, locale: string): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function applyClientStatuses(
  response: TodayResponse,
  now: Date,
): TodayResponse {
  const mapItem = (item: TodayTaskItem): TodayTaskItem => {
    const status = computeTodayTaskStatus({
      date: item.date,
      scheduledTime: item.scheduledTime,
      now,
      completedAt: item.completedAt,
    });

    return { ...item, status };
  };

  return {
    ...response,
    sections: {
      morning: response.sections.morning.map(mapItem),
      afternoon: response.sections.afternoon.map(mapItem),
      evening: response.sections.evening.map(mapItem),
    },
  };
}

function withLiveStatuses(tasks: TodayTaskItem[], now: Date): TodayTaskItem[] {
  return tasks.map((item) => ({
    ...item,
    status: computeTodayTaskStatus({
      date: item.date,
      scheduledTime: item.scheduledTime,
      now,
      completedAt: item.completedAt,
    }),
  }));
}

function replaceTaskItem(
  response: TodayResponse,
  next: TodayTaskItem,
): TodayResponse {
  const key = occurrenceKey(next);

  const replaceIn = (items: TodayTaskItem[]) =>
    items.map((item) => (occurrenceKey(item) === key ? next : item));

  return {
    ...response,
    sections: {
      morning: replaceIn(response.sections.morning),
      afternoon: replaceIn(response.sections.afternoon),
      evening: replaceIn(response.sections.evening),
    },
  };
}

export function TodayView() {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const { userId } = useAuth();

  const { getToday, completeTask, uncompleteTask, completeTemperatureTask } =
    useTodayApi();

  const localTodayDate = useMemo(() => formatLocalIsoDate(new Date()), []);

  const [selectedDate, setSelectedDate] = useState(localTodayDate);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [response, setResponse] = useState<TodayResponse | null>(null);
  const [filter, setFilter] = useState<TodayFilter>("todo");
  const [now, setNow] = useState(() => new Date());
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [tempDialogOpen, setTempDialogOpen] = useState(false);
  const [tempDialogTask, setTempDialogTask] = useState<TodayTaskItem | null>(
    null,
  );

  const load = useCallback(
    async (date: string) => {
      try {
        setIsLoading(true);
        setLoadError(false);
        const today = await getToday(date);
        const currentNow = new Date();
        setNow(currentNow);
        setResponse(applyClientStatuses(today, currentNow));
      } catch (error) {
        setLoadError(true);
        setResponse(null);
        toast.error((error as Error).message || t("toasts.loadError"));
      } finally {
        setIsLoading(false);
      }
    },
    [getToday, t],
  );

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      try {
        setIsLoading(true);
        setLoadError(false);
        const today = await getToday(selectedDate);
        if (!mounted) return;
        const currentNow = new Date();
        setNow(currentNow);
        setResponse(applyClientStatuses(today, currentNow));
      } catch (error) {
        if (!mounted) return;
        setLoadError(true);
        setResponse(null);
        toast.error((error as Error).message || t("toasts.loadError"));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void initialLoad();

    return () => {
      mounted = false;
    };
  }, [getToday, selectedDate, t]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const allTasks = useMemo(
    () => (response ? withLiveStatuses(flatTodayTasks(response), now) : []),
    [response, now],
  );

  const groupedAll = useMemo(
    () => groupTodayTasks(allTasks, now),
    [allTasks, now],
  );

  const filterCounts = useMemo(
    () => filterCountsFromGrouped(groupedAll),
    [groupedAll],
  );

  const groupedVisible = useMemo(
    () =>
      applyTodayFilter(groupedAll, filter, {
        includeCompletedWhenAllDone: true,
      }),
    [groupedAll, filter],
  );
  const nextTask = useMemo(
    () =>
      groupedAll.dueNow[0] ??
      groupedAll.upcoming[0] ??
      nextActionableTask(groupedAll),
    [groupedAll],
  );

  const completedCount = groupedAll.completed.length;
  const attentionCount =
    groupedAll.attention.length + groupedAll.overdue.length;
  const remainingCount =
    groupedAll.overdue.length +
    groupedAll.dueNow.length +
    groupedAll.upcoming.length;
  const totalCount = allTasks.length;

  const openTemperatureDialog = useCallback(
    (task: TodayTaskItem) => {
      if (
        task.minTempC === null ||
        task.maxTempC === null ||
        !task.equipmentId
      ) {
        toast.error(t("toasts.missingEquipment"));
        return;
      }

      setTempDialogTask(task);
      setTempDialogOpen(true);
    },
    [t],
  );

  const updateFromReturnedItem = useCallback((next: TodayTaskItem) => {
    const currentNow = new Date();
    setNow(currentNow);
    setResponse((current) => {
      if (!current) return current;
      const updated = replaceTaskItem(current, next);
      return applyClientStatuses(updated, currentNow);
    });
  }, []);

  const handleUndo = useCallback(
    async (task: TodayTaskItem) => {
      const key = occurrenceKey(task);
      setPendingKey(key);
      try {
        const result = await uncompleteTask({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        updateFromReturnedItem(result);
      } catch (error) {
        toast.error((error as Error).message || t("toasts.undoError"));
      } finally {
        setPendingKey(null);
      }
    },
    [t, uncompleteTask, updateFromReturnedItem],
  );

  const handleComplete = useCallback(
    async (task: TodayTaskItem) => {
      const key = occurrenceKey(task);
      setPendingKey(key);
      try {
        const result = await completeTask({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        updateFromReturnedItem(result);
      } catch (error) {
        toast.error((error as Error).message || t("toasts.doneError"));
      } finally {
        setPendingKey(null);
      }
    },
    [completeTask, t, updateFromReturnedItem],
  );

  const handleTemperatureDone = useCallback(
    async (recordedC: number, correctiveAction?: string) => {
      if (!tempDialogTask) return;

      const key = occurrenceKey(tempDialogTask);
      setPendingKey(key);
      try {
        const result = await completeTemperatureTask({
          templateId: tempDialogTask.templateId,
          date: tempDialogTask.date,
          scheduledTime: tempDialogTask.scheduledTime,
          recordedC,
          correctiveAction,
        });

        updateFromReturnedItem(result);
        setTempDialogOpen(false);
        setTempDialogTask(null);
      } catch (error) {
        toast.error((error as Error).message || t("toasts.doneError"));
      } finally {
        setPendingKey(null);
      }
    },
    [completeTemperatureTask, tempDialogTask, t, updateFromReturnedItem],
  );

  if (isLoading) {
    return <TodayPageSkeleton />;
  }

  if (loadError || !response) {
    return (
      <TodayWorkspace>
        <TodayHeader
          title={t("title")}
          dateLabel={formatDate(selectedDate, locale)}
          completed={0}
          total={0}
          remaining={0}
          attention={0}
          isToday={selectedDate === localTodayDate}
          onPreviousDay={() => setSelectedDate((date) => shiftDate(date, -1))}
          onToday={() => setSelectedDate(localTodayDate)}
          onNextDay={() => setSelectedDate((date) => shiftDate(date, 1))}
        />
        <Alert>
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>{t("error.description")}</AlertDescription>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              void load(selectedDate);
            }}
          >
            {t("error.retry")}
          </Button>
        </Alert>
      </TodayWorkspace>
    );
  }

  return (
    <TodayWorkspace>
      <TodayHeader
        title={
          selectedDate === localTodayDate ? t("title") : t("selectedDayTitle")
        }
        dateLabel={formatDate(response.date, locale)}
        completed={completedCount}
        total={totalCount}
        remaining={remainingCount}
        attention={attentionCount}
        isToday={selectedDate === localTodayDate}
        onPreviousDay={() => setSelectedDate((date) => shiftDate(date, -1))}
        onToday={() => setSelectedDate(localTodayDate)}
        onNextDay={() => setSelectedDate((date) => shiftDate(date, 1))}
      />

      {totalCount === 0 ? (
        <TodayEmptyState />
      ) : (
        <>
          <TodaySummary
            completed={completedCount}
            total={totalCount}
            remaining={remainingCount}
            attention={attentionCount}
            nextTask={nextTask}
            now={now}
            onFilterChange={setFilter}
          />

          <TodayPriorityBanner
            task={nextActionableTask(groupedAll)}
            pendingKey={pendingKey}
            onComplete={handleComplete}
            onRecordTemperature={openTemperatureDialog}
          />

          <div className="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
            <main className="min-w-0">
              <TodayTaskWorkspace
                filter={filter}
                counts={filterCounts}
                grouped={groupedVisible}
                totalCount={totalCount}
                completedCount={completedCount}
                now={now}
                pendingKey={pendingKey}
                currentUserId={userId ?? null}
                onFilterChange={setFilter}
                onComplete={handleComplete}
                onUndo={handleUndo}
                onRecordTemperature={openTemperatureDialog}
              />
            </main>
            <aside
              className="hidden min-w-0 lg:block"
              aria-label={t("overview.ariaLabel")}
            >
              <TodayOverview grouped={groupedAll} />
            </aside>
          </div>
        </>
      )}

      {tempDialogTask &&
        tempDialogTask.minTempC !== null &&
        tempDialogTask.maxTempC !== null && (
          <TemperatureCheckDialog
            open={tempDialogOpen}
            onOpenChange={(open) => {
              setTempDialogOpen(open);
              if (!open) setTempDialogTask(null);
            }}
            task={tempDialogTask}
            minTempC={tempDialogTask.minTempC}
            maxTempC={tempDialogTask.maxTempC}
            onConfirm={handleTemperatureDone}
          />
        )}
    </TodayWorkspace>
  );
}
