"use client";

import {
  addCalendarDays,
  API_ERROR_CODE,
  zonedDateString,
  zonedTimeString,
  type AnswersInput,
  type CorrectiveInput,
  type TodayOnDemandForm,
  type TodayOnDemandItem,
  type TodayResponse,
} from "@haccp/shared";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ClipboardPlusIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pageWidthVariants } from "@/components/layout/page-container";
import {
  FALLBACK_FORM_ICON,
  FORM_CATEGORY_ICONS,
} from "@/features/forms/lib/category-icon";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { useNow } from "@/hooks/use-now";
import { ApiRequestError } from "@/lib/api-utils";
import { cn } from "@/lib/utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { CheckForm } from "./components/check-form";
import {
  CheckPanel,
  PANEL_COLUMN_CLASS,
  type PanelHeading,
} from "./components/check-panel";
import { ItemChecks } from "./components/item-checks";
import { LogEntryPanel } from "./components/log-entry-panel";
import { InlineCheck, type CheckSave } from "./components/inline-check";
import { TodayEmptyState } from "./components/today-empty-state";
import { TodayHeader } from "./components/today-header";
import { TodaySections } from "./components/today-sections";
import { useSideBySide } from "./hooks/use-side-by-side";
import { useTodayLabels } from "./hooks/use-today-labels";
import { useTodayMutations } from "./hooks/use-today-mutations";
import { useTodayQuery } from "./hooks/use-today-query";
import { formatLongDate } from "./lib/format";
import { correctiveFields, savedCorrective } from "./lib/corrective-action";
import { tapFeedback } from "./lib/haptics";
import { inlineField, type InlineDrafts } from "./lib/inline-check";
import {
  buildTodayDay,
  checkShape,
  findGroup,
  type TodayCheck,
  type TodayDay,
  type TodayEntry,
  type TodayGroup,
} from "./lib/today-day";

type Selection =
  | { type: "group"; key: string }
  | { type: "entry"; key: string }
  | { type: "log" };

/** What opens beside the list on a wide screen before anything is picked. */
function defaultSelection(day: TodayDay): Selection | null {
  const group =
    day.todo[0] ?? day.later.find((item) => !item.isLocked) ?? day.done[0];
  if (group) return { type: "group", key: group.key };
  const [entry] = day.entries;
  return entry ? { type: "entry", key: entry.key } : null;
}

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
  const showApiError = useApiErrorToast();
  const now = useNow();
  const timeZone = useOrgTimeZone();
  // A sheet over the list until both fit side by side.
  const isMobile = !useSideBySide();
  const { locationId } = useLocation();

  // Recalculate from the ticking clock so an overnight tablet does not keep yesterday's date.
  const todayDate = useMemo(
    () => zonedDateString(now, timeZone),
    [now, timeZone],
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lastSelection, setLastSelection] = useState<Selection | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [inlineDrafts, setInlineDrafts] = useState<InlineDrafts>({});

  // Latched so the sheet still has its content while it slides away.
  if (selection && selection !== lastSelection) setLastSelection(selection);

  // Reset during render: another day or location must not open with this one's check.
  const scope = `${locationId}|${selectedDate}`;
  const [resetFor, setResetFor] = useState(scope);
  if (resetFor !== scope) {
    setResetFor(scope);
    setSelection(null);
    setLastSelection(null);
  }

  const {
    data: response,
    error,
    refetch,
  } = useTodayQuery(selectedDate, {
    initialData: selectedDate === initialDate ? initialData : undefined,
    initialLocationId,
  });

  const yesterdayDate = addCalendarDays(todayDate, -1);
  const { data: yesterday } = useTodayQuery(yesterdayDate, {
    enabled: selectedDate === todayDate,
  });

  const currentUserId = response?.currentUserId ?? initialData.currentUserId;
  const { createRecord, updateRecord, createEntry } =
    useTodayMutations(currentUserId);
  const labels = useTodayLabels(currentUserId, timeZone);

  // Depend on the stable mutate functions, not the result object (fresh every render).
  const runCreate = createRecord.mutateAsync;
  const runUpdate = updateRecord.mutateAsync;
  const runCreateEntry = createEntry.mutateAsync;

  // A response for another day is only the placeholder while the right one loads.
  const day = useMemo(
    () =>
      response && response.date === selectedDate
        ? buildTodayDay(response, now, timeZone)
        : null,
    [response, selectedDate, now, timeZone],
  );

  const yesterdayOpen = useMemo(() => {
    if (!yesterday || yesterday.date !== yesterdayDate) return 0;
    const built = buildTodayDay(yesterday, now, timeZone);
    return built.total - built.doneCount;
  }, [yesterday, yesterdayDate, now, timeZone]);

  /** A voided check reactivates its existing record; only an unrecorded one is created. */
  const saveCheck = useCallback(
    async (
      check: TodayCheck,
      values: AnswersInput,
      corrective?: CorrectiveInput,
    ) => {
      const { task } = check;
      if (task.recordId) {
        await runUpdate({
          key: check.key,
          recordId: task.recordId,
          date: task.date,
          values,
          ...correctiveFields(corrective),
        });
        return;
      }
      await runCreate({
        key: check.key,
        occurrenceId: check.key,
        date: task.date,
        values,
        ...correctiveFields(corrective),
      });
    },
    [runCreate, runUpdate],
  );

  const saveOne = useCallback(
    async (
      check: TodayCheck,
      values: AnswersInput,
      corrective?: CorrectiveInput,
    ): Promise<boolean> => {
      tapFeedback();
      try {
        await saveCheck(check, values, corrective);
        return true;
      } catch (saveError) {
        showApiError(saveError);
        return false;
      }
    },
    [saveCheck, showApiError],
  );

  /** One toast for the whole batch: twelve failed rows should not stack twelve errors. */
  const saveAll = useCallback(
    async (saves: CheckSave[]): Promise<string[]> => {
      tapFeedback();
      const results = await Promise.allSettled(
        saves.map((save) =>
          saveCheck(save.check, save.values, save.corrective),
        ),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") showApiError(failed.reason);

      return saves
        .filter((_save, index) => results[index]?.status === "fulfilled")
        .map((save) => save.check.key);
    },
    [saveCheck, showApiError],
  );

  const announceRecorded = useCallback(
    (title: string) => {
      setAnnouncement(t("a11y.recorded", { title }));
      toast.success(t("toasts.recorded", { title }));
    },
    [t],
  );

  const closePanel = useCallback(() => setSelection(null), []);

  /** On a phone the check closes once it is done; beside the list it stays to show the result. */
  const finish = useCallback(
    (title: string) => {
      announceRecorded(title);
      if (isMobile) setSelection(null);
    },
    [announceRecorded, isMobile],
  );

  const handleCreateEntry = useCallback(
    async (
      form: TodayOnDemandForm,
      item: TodayOnDemandItem | null,
      values: AnswersInput,
      corrective?: CorrectiveInput,
    ): Promise<boolean> => {
      tapFeedback();
      try {
        await runCreateEntry({
          formId: form.formId,
          formVersionId: form.formVersionId,
          targetId: item?.targetId ?? null,
          values,
          ...correctiveFields(corrective),
          // Filed under the day being viewed; the record itself keeps when it was really entered.
          entryDate: selectedDate,
          entryTime: zonedTimeString(new Date(), timeZone),
        });
        announceRecorded(form.name);
        setSelection(null);
        return true;
      } catch (createError) {
        showApiError(createError);
        if (
          createError instanceof ApiRequestError &&
          createError.code === API_ERROR_CODE.FORM_VERSION_CHANGED
        ) {
          // The answers no longer fit the form; start again from the fresh one.
          setSelection(null);
          void refetch();
        }
        return false;
      }
    },
    [
      announceRecorded,
      refetch,
      runCreateEntry,
      selectedDate,
      showApiError,
      timeZone,
    ],
  );

  const onDemandForms = response?.onDemand.forms ?? [];
  const canLog = day !== null && !day.isFuture && onDemandForms.length > 0;

  const shown = isMobile
    ? (selection ?? lastSelection)
    : (selection ?? (day ? defaultSelection(day) : null));

  let activeGroup: TodayGroup | null = null;
  let activeEntry: TodayEntry | null = null;
  if (day && shown?.type === "group") {
    activeGroup = findGroup(day, shown.key);
  } else if (day && shown?.type === "entry") {
    activeEntry = day.entries.find((entry) => entry.key === shown.key) ?? null;
  }
  const isLogging = shown?.type === "log" && canLog;

  let heading: PanelHeading | null = null;
  let body: ReactNode = null;

  if (activeGroup) {
    const group = activeGroup;
    const form = group.form;
    const CategoryIcon = form
      ? FORM_CATEGORY_ICONS[form.category]
      : FALLBACK_FORM_ICON;

    heading = {
      title: group.title,
      subtitle: group.isComplete
        ? t("panel.completed", {
            when: labels.completion(group.completedAt, group.completedBy),
          })
        : `${labels.when(group.window, group.scheduledTime)} · ${labels.progress(group)}`,
      icon: group.isComplete
        ? group.hasDeviation
          ? CircleAlertIcon
          : CheckIcon
        : CategoryIcon,
      tone: group.isComplete
        ? group.hasDeviation
          ? "destructive"
          : "success"
        : group.isLate
          ? "destructive"
          : "primary",
      badge: group.isComplete ? (
        <Badge variant="success">
          <CheckIcon />
          {t("panel.completedBadge")}
        </Badge>
      ) : group.isLate ? (
        <Badge variant="destructive">{t("row.late")}</Badge>
      ) : undefined,
    };

    if (!form) {
      body = (
        <Alert>
          <AlertDescription>{t("toasts.missingForm")}</AlertDescription>
        </Alert>
      );
    } else {
      const shape = checkShape(group);
      const field = inlineField(form.definition);
      const [only] = group.checks;

      if (shape === "inline" && field) {
        body = (
          <InlineCheck
            group={group}
            form={form}
            field={field}
            drafts={inlineDrafts}
            setDrafts={setInlineDrafts}
            onSaveAll={saveAll}
            onComplete={() => finish(group.title)}
          />
        );
      } else if (shape === "items") {
        body = (
          <ItemChecks
            group={group}
            form={form}
            onSave={saveOne}
            onComplete={() => finish(group.title)}
          />
        );
      } else if (only) {
        body = (
          <CheckForm
            entryKey={only.key}
            definition={form.definition}
            limits={only.task.resolvedLimits}
            initialValues={only.task.values}
            initialCorrective={savedCorrective(only.task)}
            saveLabel={t("recordDialog.save")}
            disabled={only.status === "upcoming"}
            onSubmit={async (values, corrective) => {
              const saved = await saveOne(only, values, corrective);
              if (saved) finish(group.title);
              return saved;
            }}
          />
        );
      }
    }
  } else if (activeEntry) {
    const entry = activeEntry;

    heading = {
      title: entry.task.title,
      subtitle: [
        labels.completion(entry.task.completedAt, entry.task.completedBy),
        entry.task.targetName,
      ]
        .filter(Boolean)
        .join(" · "),
      icon: entry.isDeviation ? CircleAlertIcon : CheckIcon,
      tone: entry.isDeviation ? "destructive" : "success",
    };
    body = entry.form ? (
      <CheckForm
        entryKey={entry.key}
        definition={entry.form.definition}
        limits={entry.task.resolvedLimits}
        initialValues={entry.task.values}
        initialCorrective={savedCorrective(entry.task)}
        saveLabel={t("recordDialog.save")}
        onSubmit={async (values, corrective) => {
          const saved = await saveOne(
            {
              key: entry.key,
              task: entry.task,
              status: "completed",
              isDone: true,
              isDeviation: entry.isDeviation,
            },
            values,
            corrective,
          );
          if (saved) finish(entry.task.title);
          return saved;
        }}
      />
    ) : (
      <Alert>
        <AlertDescription>{t("toasts.missingForm")}</AlertDescription>
      </Alert>
    );
  } else if (isLogging && response) {
    heading = {
      title: t("logEntry.title"),
      subtitle: formatLongDate(selectedDate, locale),
      icon: ClipboardPlusIcon,
      tone: "primary",
    };
    body = (
      <LogEntryPanel
        forms={onDemandForms}
        items={response.onDemand.items}
        formVersions={response.formVersions}
        savedNote={
          day?.isToday
            ? t("logEntry.savedNow", { time: zonedTimeString(now, timeZone) })
            : t("logEntry.savedToDay", {
                date: formatLongDate(selectedDate, locale),
              })
        }
        onCreate={handleCreateEntry}
      />
    );
  }

  const header = (
    <TodayHeader
      date={selectedDate}
      todayDate={todayDate}
      now={now}
      timeZone={timeZone}
      progress={{
        total: day?.total ?? 0,
        done: day?.doneCount ?? 0,
        deviations: day?.deviationCount ?? 0,
      }}
      onDateChange={setSelectedDate}
      onLogEntry={canLog ? () => setSelection({ type: "log" }) : undefined}
    />
  );

  if (!day) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        {error && !response ? (
          <div className={cn(pageWidthVariants(), "pt-6")}>
            <ApiQueryError error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
          <div className="flex justify-center py-24" aria-busy="true">
            <Spinner className="size-8" />
            <span className="sr-only">{t("loading")}</span>
          </div>
        )}
      </div>
    );
  }

  const isEmpty = day.total === 0 && day.entries.length === 0;
  const hasPanel = heading !== null;

  return (
    <div className="flex flex-1 flex-col">
      {header}

      <div
        className={cn(
          pageWidthVariants(),
          "flex flex-1 flex-col gap-6 pt-4 pb-16 md:pt-6 xl:flex-row xl:items-start",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5 xl:flex-1">
          {day.isToday && yesterdayOpen > 0 ? (
            <Button
              variant="outline"
              className="h-auto min-h-11 w-full justify-start px-3.5 py-2 text-left font-normal whitespace-normal [&>span]:w-full [&>span]:justify-between"
              onClick={() => setSelectedDate(yesterdayDate)}
              data-testid="yesterday-hint"
            >
              {t("yesterdayHint", { count: yesterdayOpen })}
              <ChevronRightIcon className="shrink-0 text-muted-foreground" />
            </Button>
          ) : null}

          {isEmpty ? (
            <TodayEmptyState />
          ) : (
            <TodaySections
              day={day}
              selectedKey={
                !isMobile && shown && shown.type !== "log" ? shown.key : null
              }
              currentUserId={currentUserId}
              timeZone={timeZone}
              onOpenGroup={(group) =>
                setSelection({ type: "group", key: group.key })
              }
              onOpenEntry={(entry) =>
                setSelection({ type: "entry", key: entry.key })
              }
            />
          )}

          {day.isFuture && !isEmpty ? (
            <p className="px-1 text-sm text-muted-foreground">
              {t("futureNote")}
            </p>
          ) : null}
        </div>

        {isMobile ? (
          <CheckPanel
            mode="sheet"
            open={selection !== null && hasPanel}
            heading={heading}
            backLabel={t("panel.back")}
            onClose={closePanel}
          >
            {body}
          </CheckPanel>
        ) : isEmpty && !hasPanel ? null : (
          <div className={cn("min-w-0", PANEL_COLUMN_CLASS)}>
            <CheckPanel
              mode="card"
              open
              heading={heading}
              backLabel={t("panel.back")}
              onClose={closePanel}
            >
              {hasPanel ? (
                body
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {day.isFuture ? t("futureNote") : t("panel.empty")}
                </p>
              )}
            </CheckPanel>
          </div>
        )}
      </div>

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
