"use client";

import {
  AlarmClockIcon,
  Clock3Icon,
  DoorOpenIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubPanel } from "@/features/task-templates/components/builder/builder-section";
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import {
  DUE_OPTIONS,
  OPENS_OPTIONS,
  isStartOfDay,
} from "@/features/task-templates/lib/completion-window";
import {
  opensAt,
  overdueAt,
  smallestGap,
  windowsOverlap,
} from "@/features/task-templates/lib/schedule";
import type { TaskDraft } from "@/features/task-templates/lib/task-draft";
import { cn } from "@/lib/utils";

const NEVER = "never";

type WindowFieldsProps = {
  idPrefix: string;
  draft: TaskDraft;
  times: string[];
  onChange: (patch: Partial<TaskDraft>) => void;
  layout: "desktop" | "mobile";
};

/** Saved values outside the offered choices stay selectable instead of silently changing. */
function withCurrent<T extends number | null>(options: readonly T[], current: T): T[] {
  return options.includes(current) ? [...options] : [...options, current];
}

/** The note shown while the window is off and the choices shown once it is on. */
export function WindowFields({ idPrefix, draft, times, onChange, layout }: WindowFieldsProps) {
  const t = useTranslations("TasksPage.builder.window");
  const labels = useScheduleLabels();
  const isMobile = layout === "mobile";

  if (!draft.windowOn) {
    return times.length > 1 ? (
      <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="text-[13px]">
          {isMobile
            ? t("mobileOffNote", { count: times.length })
            : t("offNote", { count: times.length })}
        </span>
      </div>
    ) : null;
  }

  const optionLabel = (minutes: number | null, forOpens: boolean) => {
    if (minutes === null) return t("never");
    if (minutes === 0) return t("onTime");
    if (forOpens && isStartOfDay(minutes)) return t("startOfDay");
    return labels.duration(minutes);
  };
  const toValue = (minutes: number | null) => (minutes === null ? NEVER : String(minutes));

  const first = times[0];
  const example = first
    ? draft.dueAfter === null
      ? t("exampleNoDeadline", { time: first, opens: opensAt(first, draft.opensBefore) })
      : t("example", {
          time: first,
          opens: opensAt(first, draft.opensBefore),
          overdue: overdueAt(first, draft.dueAfter),
        })
    : t("exampleEmpty");
  const overlap = windowsOverlap(times, draft.opensBefore, draft.dueAfter);
  const gap = smallestGap(times);

  const group = (
    key: "opens" | "overdue",
    options: (number | null)[],
    value: number | null,
    apply: (minutes: number | null) => void,
  ) => (
    <SubPanel
      icon={key === "opens" ? DoorOpenIcon : AlarmClockIcon}
      title={t(key)}
      titleId={`${idPrefix}-${key}`}
      description={t(isMobile ? `${key}MobileDescription` : `${key}Description`)}
      compact={isMobile}
    >
      <ToggleGroup
        aria-labelledby={`${idPrefix}-${key}`}
        variant="outline"
        spacing={isMobile ? 1 : 2}
        className="flex-wrap"
        value={[toValue(value)]}
        onValueChange={(next) => {
          const picked = next.at(-1);
          if (picked) apply(picked === NEVER ? null : Number(picked));
        }}
      >
        {options.map((minutes) => (
          <ToggleGroupItem key={toValue(minutes)} value={toValue(minutes)}>
            {optionLabel(minutes, key === "opens")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SubPanel>
  );

  return (
    <div className={cn("flex flex-col gap-3", !isMobile && "pl-10")}>
      {group(
        "opens",
        withCurrent<number | null>(OPENS_OPTIONS, draft.opensBefore),
        draft.opensBefore,
        (minutes) => onChange({ opensBefore: minutes ?? 0 }),
      )}
      {group(
        "overdue",
        withCurrent<number | null>(DUE_OPTIONS, draft.dueAfter),
        draft.dueAfter,
        (minutes) => onChange({ dueAfter: minutes }),
      )}
      <p className="flex items-center gap-2 text-[13px]">
        {isMobile ? null : <Clock3Icon className="size-4 shrink-0" aria-hidden />}
        {example}
      </p>
      {overlap && gap !== null && draft.dueAfter !== null ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-warning/15 px-3.5 py-3">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span className="text-[13px]">
            <strong className="font-semibold">{t("overlapTitle")}</strong>{" "}
            {t(isMobile ? "mobileOverlap" : "overlap", {
              gap: labels.duration(gap),
              length: labels.duration(draft.opensBefore + draft.dueAfter),
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
