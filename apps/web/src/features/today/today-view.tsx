"use client";

import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/api/get-error-message";
import { formatLocalDate, localTodayDate, shiftLocalDate } from "@/lib/date";
import { useNow } from "@/hooks/use-now";
import { TemperatureCheckDialog } from "./components/temperature-check-dialog";
import { TodayEmptyState } from "./components/today-empty-state";
import {
  applyTodayFilter,
  filterCountsFromGrouped,
  flatTodayTasks,
  groupTodayTasks,
  nextActionableTask,
  occurrenceKey,
  type TodayFilter,
} from "./lib/today-grouping";
import { TodayHeader } from "./components/today-header";
import { TodayOverview } from "./components/today-overview";
import { TodayPriorityBanner } from "./components/today-priority-banner";
import { TodaySummary } from "./components/today-summary";
import { TodayTaskWorkspace } from "./components/today-task-workspace";
import { TodayWorkspace } from "./components/today-workspace";
import { useTodayMutations } from "./hooks/use-today-mutations";
import { useTodayQuery } from "./hooks/use-today-query";

export function TodayView({
  initialData,
  initialDate,
  initialLocationId,
}: {
  initialData: TodayResponse;
  initialDate: string;
  initialLocationId: string;
}) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const now = useNow();

  const todayDate = useMemo(() => localTodayDate(), []);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [filter, setFilter] = useState<TodayFilter>("todo");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingAwaitingResponseRef = useRef(false);
  const [tempDialogOpen, setTempDialogOpen] = useState(false);
  const [tempDialogTask, setTempDialogTask] = useState<TodayTaskItem | null>(
    null,
  );

  const {
    data: response,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useTodayQuery(selectedDate, {
    initialData: selectedDate === initialDate ? initialData : undefined,
    initialLocationId,
  });

  const { completeTask, uncompleteTask, completeTemperatureTask } =
    useTodayMutations();

  const allTasks = useMemo(
    () => (response ? flatTodayTasks(response) : []),
    [response],
  );

  useEffect(() => {
    if (!pendingKey || !pendingAwaitingResponseRef.current) return;
    pendingAwaitingResponseRef.current = false;
    setPendingKey(null);
  }, [pendingKey, response]);

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

  const handlePreviousDay = useCallback(() => {
    setSelectedDate((date) => shiftLocalDate(date, -1));
  }, []);

  const handleToday = useCallback(() => {
    setSelectedDate(todayDate);
  }, [todayDate]);

  const handleNextDay = useCallback(() => {
    setSelectedDate((date) => shiftLocalDate(date, 1));
  }, []);

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

  const handleUndo = useCallback(
    async (task: TodayTaskItem) => {
      const key = occurrenceKey(task);
      setPendingKey(key);
      try {
        await uncompleteTask.mutateAsync({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        pendingAwaitingResponseRef.current = true;
        await refetch();
      } catch (error) {
        setPendingKey(null);
        toast.error(getErrorMessage(error, t("toasts.undoError")));
      }
    },
    [refetch, t, uncompleteTask],
  );

  const handleComplete = useCallback(
    async (task: TodayTaskItem) => {
      const key = occurrenceKey(task);
      setPendingKey(key);
      try {
        await completeTask.mutateAsync({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        pendingAwaitingResponseRef.current = true;
        await refetch();
      } catch (error) {
        setPendingKey(null);
        toast.error(getErrorMessage(error, t("toasts.doneError")));
      }
    },
    [completeTask, refetch, t],
  );

  const handleTemperatureDone = useCallback(
    async (recordedC: number, correctiveAction?: string) => {
      if (!tempDialogTask) return;

      const key = occurrenceKey(tempDialogTask);
      setPendingKey(key);
      try {
        await completeTemperatureTask.mutateAsync({
          templateId: tempDialogTask.templateId,
          date: tempDialogTask.date,
          scheduledTime: tempDialogTask.scheduledTime,
          recordedC,
          correctiveAction,
        });
        pendingAwaitingResponseRef.current = true;
        await refetch();
        setTempDialogOpen(false);
        setTempDialogTask(null);
      } catch (error) {
        setPendingKey(null);
        toast.error(getErrorMessage(error, t("toasts.doneError")));
      }
    },
    [completeTemperatureTask, refetch, tempDialogTask, t],
  );

  if (isLoading && !response) {
    return (
      <TodayWorkspace>
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      </TodayWorkspace>
    );
  }

  if (isError || !response) {
    return (
      <TodayWorkspace>
        <TodayHeader
          title={t("title")}
          dateLabel={formatLocalDate(selectedDate, locale)}
          completed={0}
          total={0}
          remaining={0}
          attention={0}
          isToday={selectedDate === todayDate}
          onPreviousDay={handlePreviousDay}
          onToday={handleToday}
          onNextDay={handleNextDay}
        />
        <Alert>
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>{t("error.description")}</AlertDescription>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              void refetch();
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
          selectedDate === todayDate ? t("title") : t("selectedDayTitle")
        }
        dateLabel={formatLocalDate(response.date, locale)}
        completed={completedCount}
        total={totalCount}
        remaining={remainingCount}
        attention={attentionCount}
        isToday={selectedDate === todayDate}
        onPreviousDay={handlePreviousDay}
        onToday={handleToday}
        onNextDay={handleNextDay}
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
            task={nextTask}
            pendingKey={pendingKey}
            onComplete={handleComplete}
            onRecordTemperature={openTemperatureDialog}
          />

          <div className="relative grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
            {isFetching && response.date !== selectedDate ? (
              <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
                <Spinner className="size-5" />
              </div>
            ) : null}
            <main className="min-w-0">
              <div className="mb-6 lg:hidden">
                <TodayOverview grouped={groupedAll} />
              </div>
              <TodayTaskWorkspace
                filter={filter}
                counts={filterCounts}
                grouped={groupedVisible}
                totalCount={totalCount}
                completedCount={completedCount}
                now={now}
                pendingKey={pendingKey}
                currentUserId={
                  response?.currentUserId ?? initialData.currentUserId
                }
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
              if (
                !open &&
                (pendingKey === occurrenceKey(tempDialogTask) ||
                  completeTemperatureTask.isPending)
              ) {
                return;
              }
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
