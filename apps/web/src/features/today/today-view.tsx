"use client";

import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { classifyTemperatureResult, zonedDateString } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useNow } from "@/hooks/use-now";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { getErrorMessage } from "@/lib/api/get-error-message";
import { formatLocalDate, shiftLocalDate } from "@/lib/date";
import { TemperatureRoundFlow } from "./components/temperature-round-flow";
import { TodayAllDone } from "./components/today-all-done";
import { TodayEmptyState } from "./components/today-empty-state";
import { TodayJumpToNow } from "./components/today-jump-to-now";
import { TodayRecordSheet } from "./components/today-record-sheet";
import { TodayStickyHeader } from "./components/today-sticky-header";
import { TodayTimeline } from "./components/today-timeline";
import {
  useTemperatureRound,
  type RoundTally,
} from "./hooks/use-temperature-round";
import { useTodayMutations } from "./hooks/use-today-mutations";
import { useTodayQuery } from "./hooks/use-today-query";
import { tapFeedback } from "./lib/haptics";
import { flatTodayTasks, occurrenceKey } from "./lib/today-grouping";
import {
  applyClock,
  buildTodayTaskGroups,
  findTimelineItem,
  type TodayTimelineItem,
} from "./lib/today-timeline";

const UNDO_TOAST_DURATION_MS = 5000;

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
  const timeZone = useOrgTimeZone();

  // Derived from the ticking clock, not memoised once: a wall-mounted tablet
  // left open overnight used to keep reporting yesterday while the groups
  // around it rolled over to overdue. Also picks up a timezone change live.
  const todayDate = useMemo(
    () => zonedDateString(now, timeZone),
    [now, timeZone],
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [syncingKeys, setSyncingKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [recordKey, setRecordKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

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

  const currentUserId = response?.currentUserId ?? initialData.currentUserId;
  const { completeTask, uncompleteTask, completeTemperatureTask } =
    useTodayMutations(currentUserId, timeZone);

  // useMutation hands back a fresh result object every render, but the mutate
  // functions themselves are stable. Depending on those keeps the handlers —
  // and therefore the memoized rows — from re-creating on every tick.
  const runComplete = completeTask.mutateAsync;
  const runUncomplete = uncompleteTask.mutateAsync;
  const runCompleteTemperature = completeTemperatureTask.mutateAsync;

  // Two stages, so the minute tick cannot reallocate the rows. Everything the
  // clock does not affect — grouping, per-item state, the counts — is memoised
  // on the response alone, and applyClock layers the live state on top while
  // carrying each group's items through by reference. That is what lets the
  // memo on TodayTaskRow actually bail out between ticks.
  const taskGroups = useMemo(
    () => buildTodayTaskGroups(response ? flatTodayTasks(response) : []),
    [response],
  );

  const timeline = useMemo(
    () => applyClock(taskGroups, now, selectedDate, timeZone),
    [taskGroups, now, selectedDate, timeZone],
  );

  // Both surfaces hold a key rather than the item itself: the clock tick
  // rebuilds the timeline every minute, and a captured item would keep serving
  // the prior reading it happened to see when it was opened.
  const recordItem = useMemo(
    () => findTimelineItem(timeline, recordKey),
    [timeline, recordKey],
  );

  const round = useTemperatureRound(timeline);
  const {
    open: openRound,
    recordSaved,
    advance: advanceRound,
    skip: skipRound,
    close: closeRound,
  } = round;

  const markSyncing = useCallback((key: string, syncing: boolean) => {
    setSyncingKeys((previous) => {
      const next = new Set(previous);
      if (syncing) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleUndo = useCallback(
    async function undo(task: TodayTaskItem): Promise<void> {
      const key = occurrenceKey(task);
      markSyncing(key, true);
      try {
        await runUncomplete({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        setRecordKey(null);
        setAnnouncement(t("a11y.undone", { title: task.title }));
      } catch (error) {
        toast.error(getErrorMessage(error, t("toasts.undoError")), {
          action: {
            label: t("error.retry"),
            onClick: () => void undo(task),
          },
        });
      } finally {
        markSyncing(key, false);
      }
    },
    [markSyncing, runUncomplete, t],
  );

  const handleComplete = useCallback(
    async function complete(task: TodayTaskItem): Promise<void> {
      const key = occurrenceKey(task);
      markSyncing(key, true);
      tapFeedback();
      try {
        await runComplete({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
        });
        setAnnouncement(t("a11y.completed", { title: task.title }));
        toast.success(t("toasts.completed", { title: task.title }), {
          duration: UNDO_TOAST_DURATION_MS,
          action: {
            label: t("actions.undo"),
            onClick: () => void handleUndo(task),
          },
        });
      } catch (error) {
        toast.error(getErrorMessage(error, t("toasts.doneError")), {
          action: {
            label: t("error.retry"),
            onClick: () => void complete(task),
          },
        });
      } finally {
        markSyncing(key, false);
      }
    },
    [handleUndo, markSyncing, runComplete, t],
  );

  /**
   * One toast for a finished round, instead of leaving the worker to count the
   * five per-save toasts that scrolled past while they were walking.
   */
  const summariseRound = useCallback(
    (tally: RoundTally, roundSize: number) => {
      if (roundSize <= 1 || tally.saved === 0) return;
      toast.success(
        tally.deviations > 0
          ? t("temperatureDialog.roundSummaryDeviations", {
              saved: tally.saved,
              deviations: tally.deviations,
            })
          : t("temperatureDialog.roundSummary", { count: tally.saved }),
      );
    },
    [t],
  );

  const handleTemperatureConfirm = useCallback(
    async (recordedC: number, correctiveAction?: string): Promise<boolean> => {
      const task = round.item?.task;
      if (!task) return false;

      const key = occurrenceKey(task);
      // Captured before advancing, which clears the round it describes.
      const roundSize = round.size;
      markSyncing(key, true);
      tapFeedback();
      try {
        await runCompleteTemperature({
          templateId: task.templateId,
          date: task.date,
          scheduledTime: task.scheduledTime,
          recordedC,
          correctiveAction,
        });
        setAnnouncement(t("a11y.recorded", { title: task.title }));
        toast.success(t("toasts.recorded", { title: task.title }), {
          duration: UNDO_TOAST_DURATION_MS,
          action: {
            label: t("actions.undo"),
            onClick: () => void handleUndo(task),
          },
        });

        recordSaved(
          task.minTempC !== null && task.maxTempC !== null
            ? classifyTemperatureResult({
                recordedC,
                minTempC: task.minTempC,
                maxTempC: task.maxTempC,
              })
            : "ok",
        );

        const result = advanceRound();
        if (result.done) summariseRound(result, roundSize);
        return true;
      } catch (error) {
        // The surface stays open on the same reading so it is not lost.
        toast.error(getErrorMessage(error, t("toasts.doneError")));
        return false;
      } finally {
        markSyncing(key, false);
      }
    },
    [
      advanceRound,
      handleUndo,
      markSyncing,
      recordSaved,
      round.item,
      round.size,
      runCompleteTemperature,
      summariseRound,
      t,
    ],
  );

  const handleTemperatureSkip = useCallback(() => {
    const roundSize = round.size;
    const result = skipRound();
    if (result.done) summariseRound(result, roundSize);
  }, [round.size, skipRound, summariseRound]);

  const handleTemperatureClose = useCallback(() => {
    const roundSize = round.size;
    summariseRound(closeRound(), roundSize);
  }, [closeRound, round.size, summariseRound]);

  const handleActivate = useCallback(
    (item: TodayTimelineItem) => {
      if (item.isCompleted) {
        setRecordKey(occurrenceKey(item.task));
        return;
      }

      if (item.task.type === "temperature") {
        if (
          item.task.minTempC === null ||
          item.task.maxTempC === null ||
          !item.task.equipmentId
        ) {
          toast.error(t("toasts.missingEquipment"));
          return;
        }
        // Also what the time group's Record button calls, so the header can
        // never start a round the flow would refuse.
        openRound(item);
        return;
      }

      void handleComplete(item.task);
    },
    [handleComplete, openRound, t],
  );

  const isToday = selectedDate === todayDate;
  const dateLabel = formatLocalDate(response?.date ?? selectedDate, locale);

  const goToPreviousDay = useCallback(
    () => setSelectedDate((date) => shiftLocalDate(date, -1)),
    [],
  );
  const goToNextDay = useCallback(
    () => setSelectedDate((date) => shiftLocalDate(date, 1)),
    [],
  );
  const goToToday = useCallback(
    () => setSelectedDate(todayDate),
    [todayDate],
  );

  const header = (
    <TodayStickyHeader
      timeline={timeline}
      selectedDate={selectedDate}
      dateLabel={dateLabel}
      isToday={isToday}
      onPreviousDay={goToPreviousDay}
      onToday={goToToday}
      onNextDay={goToNextDay}
    />
  );

  if (isLoading && !response) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      </div>
    );
  }

  if (isError || !response) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
          <Alert>
            <AlertTitle>{t("error.title")}</AlertTitle>
            <AlertDescription>{t("error.description")}</AlertDescription>
            <Button className="mt-4" onClick={() => void refetch()}>
              {t("error.retry")}
            </Button>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        {isFetching && response.date !== selectedDate ? (
          <div className="absolute inset-x-0 top-1 z-10 flex justify-center">
            <Spinner className="size-5" />
          </div>
        ) : null}

        {timeline.total === 0 ? (
          <TodayEmptyState />
        ) : (
          <div className="space-y-4">
            {timeline.isAllDone ? (
              <TodayAllDone
                total={timeline.total}
                deviationCount={timeline.deviationCount}
              />
            ) : null}

            <TodayTimeline
              timeline={timeline}
              timeZone={timeZone}
              scrollKey={selectedDate}
              syncingKeys={syncingKeys}
              currentUserId={currentUserId}
              onActivate={handleActivate}
            />

            <TodayJumpToNow nowLineIndex={timeline.nowLineIndex} />
          </div>
        )}
      </div>

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {round.item &&
      round.currentKey &&
      round.item.task.minTempC !== null &&
      round.item.task.maxTempC !== null ? (
        <TemperatureRoundFlow
          item={round.item}
          occurrenceKey={round.currentKey}
          minTempC={round.item.task.minTempC}
          maxTempC={round.item.task.maxTempC}
          position={round.position}
          size={round.size}
          onSubmit={handleTemperatureConfirm}
          onSkip={handleTemperatureSkip}
          onClose={handleTemperatureClose}
        />
      ) : null}

      {recordItem ? (
        <TodayRecordSheet
          open
          onOpenChange={(open) => {
            if (!open) setRecordKey(null);
          }}
          item={recordItem}
          currentUserId={currentUserId}
          isUndoing={syncingKeys.has(occurrenceKey(recordItem.task))}
          onUndo={(item) => void handleUndo(item.task)}
        />
      ) : null}
    </div>
  );
}
