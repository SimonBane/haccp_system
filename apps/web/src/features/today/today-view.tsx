"use client";

import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { classifyTemperatureResult, zonedDateString } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { pageWidthVariants } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useNow } from "@/hooks/use-now";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { getErrorMessage } from "@/lib/api/get-error-message";
import { formatLocalDate, shiftLocalDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  TemperatureRoundFlow,
  type TemperatureCheck,
} from "./components/temperature-round-flow";
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

  // Recalculate from the ticking clock so an overnight tablet does not keep yesterday's date.
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

  // Depend on the stable mutate functions, not the result object (fresh every render).
  const runComplete = completeTask.mutateAsync;
  const runUncomplete = uncompleteTask.mutateAsync;
  const runCompleteTemperature = completeTemperatureTask.mutateAsync;

  // Group on the response; applyClock layers live state so TodayTaskRow can bail out between ticks.
  const taskGroups = useMemo(
    () => buildTodayTaskGroups(response ? flatTodayTasks(response) : []),
    [response],
  );

  const timeline = useMemo(
    () => applyClock(taskGroups, now, selectedDate, timeZone),
    [taskGroups, now, selectedDate, timeZone],
  );

  // Hold a key, not the item: the clock rebuilds the timeline every minute.
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

  // Latch the last non-null check so Base UI can run the exit after round/recordItem go null.
  const isRoundOpen =
    round.item !== null &&
    round.currentKey !== null &&
    round.item.task.minTempC !== null &&
    round.item.task.maxTempC !== null;

  // Latch during render, not an effect — an effect would mount the popup already open.
  const [lastCheck, setLastCheck] = useState<TemperatureCheck | null>(null);

  const liveCheck: TemperatureCheck | null = isRoundOpen
    ? {
        item: round.item as TodayTimelineItem,
        occurrenceKey: round.currentKey as string,
        minTempC: round.item?.task.minTempC as number,
        maxTempC: round.item?.task.maxTempC as number,
        position: round.position,
        size: round.size,
      }
    : null;

  if (liveCheck && lastCheck?.occurrenceKey !== liveCheck.occurrenceKey) {
    setLastCheck(liveCheck);
  }

  const [lastRecordItem, setLastRecordItem] =
    useState<TodayTimelineItem | null>(null);

  if (recordItem && lastRecordItem !== recordItem) {
    setLastRecordItem(recordItem);
  }

  // Live data while open; the latched copy only covers the slide-away.
  const shownCheck = liveCheck ?? lastCheck;
  const shownRecordItem = recordItem ?? lastRecordItem;

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

  /** One toast for a finished round instead of a toast per save. */
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
        // Stay on the same reading so it is not lost.
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
        // Same gate as the time group's Record button.
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
        <div className={cn(pageWidthVariants({ width: "narrow" }), "pt-6")}>
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

      <div
        className={cn(pageWidthVariants({ width: "narrow" }), "relative pb-16")}
      >
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

      {/* Mounted from first paint and toggled by `open` so Base UI can run enter/exit. */}
      <TemperatureRoundFlow
        open={isRoundOpen}
        check={shownCheck}
        onSubmit={handleTemperatureConfirm}
        onSkip={handleTemperatureSkip}
        onClose={handleTemperatureClose}
      />

      {shownRecordItem ? (
        <TodayRecordSheet
          open={Boolean(recordItem)}
          onOpenChange={(open) => {
            if (!open) setRecordKey(null);
          }}
          item={shownRecordItem}
          currentUserId={currentUserId}
          isUndoing={syncingKeys.has(occurrenceKey(shownRecordItem.task))}
          onUndo={(item) => void handleUndo(item.task)}
        />
      ) : null}
    </div>
  );
}
