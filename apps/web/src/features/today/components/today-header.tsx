"use client";

import { zonedTimeString } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  MobileHeaderActions,
  MobileHeaderCenter,
  MobileHeaderTitle,
} from "@/components/layout/shell-slots";
import { pageWidthVariants } from "@/components/layout/page-container";
import { Pie, PieChart, type TooltipPayloadEntry } from "recharts";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { DayPicker, DayStepButton, useDayLabel } from "./day-picker";

type Progress = { total: number; done: number; deviations: number };

type Props = {
  date: string;
  todayDate: string;
  now: Date;
  timeZone: string;
  progress: Progress;
  onDateChange: (date: string) => void;
  /** Absent when there is nothing to log on this day. */
  onLogEntry?: () => void;
};

const RING_STATUSES = ["passed", "deviations", "remaining"] as const;
const RING_SIZE = { width: 28, height: 28 };

const RING_ID = "today-progress";
const TOOLTIP_POSITION = { x: 0, y: 36 };

function ProgressRing({ progress }: { progress: Progress }) {
  const t = useTranslations("TodayPage.progress");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  if (progress.total === 0) return null;

  const counts = {
    passed: progress.done - progress.deviations,
    deviations: progress.deviations,
    remaining: progress.total - progress.done,
  };
  const config = {
    passed: { label: t("passed"), color: "var(--success)" },
    deviations: { label: t("deviations"), color: "var(--destructive)" },
    remaining: { label: t("remaining"), color: "var(--muted)" },
  } satisfies ChartConfig;
  const data = RING_STATUSES.filter((status) => counts[status] > 0).map(
    (status) => ({
      status,
      count: counts[status],
      fill: `var(--color-${status})`,
    }),
  );
  const rows: TooltipPayloadEntry[] = RING_STATUSES.map((status) => ({
    graphicalItemId: RING_ID,
    name: status,
    dataKey: status,
    value: counts[status],
    payload: { status, fill: `var(--color-${status})` },
  }));
  const summary = t("short", {
    completed: progress.done,
    total: progress.total,
  });

  return (
    <ChartContainer
      config={config}
      initialDimension={RING_SIZE}
      role="progressbar"
      aria-label={summary}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.done}
      // Focus opens it too, which is how a tap on a tablet shows it.
      tabIndex={0}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="aspect-square size-7 shrink-0 cursor-default rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <PieChart>
        <ChartTooltip
          active={hovered || focused}
          // Recharts hides a tooltip with no payload of its own, as over the hole.
          defaultIndex={0}
          position={TOOLTIP_POSITION}
          isAnimationActive={false}
          allowEscapeViewBox={{ x: true, y: true }}
          wrapperStyle={{ zIndex: 50 }}
          content={({ active }) => (
            <ChartTooltipContent
              active={active}
              payload={rows}
              nameKey="status"
              labelFormatter={() => summary}
            />
          )}
        />
        <Pie
          id={RING_ID}
          data={data}
          // Hover state re-renders the chart, which would replay the sweep each time.
          isAnimationActive={false}
          dataKey="count"
          nameKey="status"
          innerRadius={8}
          outerRadius={14}
          startAngle={90}
          endAngle={-270}
        />
      </PieChart>
    </ChartContainer>
  );
}

function ProgressMeter({ progress }: { progress: Progress }) {
  const t = useTranslations("TodayPage.progress");
  if (progress.total === 0) return null;

  const passed = progress.done - progress.deviations;
  const share = (count: number) => `${(count / progress.total) * 100}%`;

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={t("summary", {
          completed: progress.done,
          total: progress.total,
        })}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        className="flex h-2 min-w-24 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {/* An empty part would still take the gap and stop a full bar short. */}
        {passed > 0 ? (
          <div
            className="bg-success transition-[width] duration-300"
            style={{ width: share(passed) }}
          />
        ) : null}
        {progress.deviations > 0 ? (
          <div
            className="bg-destructive transition-[width] duration-300"
            style={{ width: share(progress.deviations) }}
          />
        ) : null}
      </div>
      <span className="text-sm font-medium whitespace-nowrap tabular-nums">
        {t("short", { completed: progress.done, total: progress.total })}
      </span>
    </div>
  );
}

/** The ring's own label already announces the count. */
function ProgressSummary({ progress }: { progress: Progress }) {
  const t = useTranslations("TodayPage.progress");

  return (
    <div className="flex items-center gap-2.5">
      <ProgressRing progress={progress} />
      {progress.total > 0 ? (
        <span
          aria-hidden
          className="text-sm text-muted-foreground whitespace-nowrap tabular-nums"
        >
          {t("short", { completed: progress.done, total: progress.total })}
        </span>
      ) : null}
    </div>
  );
}

/** The day is the heading, progress sits in the middle, the action on the right. */
export function TodayHeader({
  date,
  todayDate,
  now,
  timeZone,
  progress,
  onDateChange,
  onLogEntry,
}: Props) {
  const t = useTranslations("TodayPage");
  const tNav = useTranslations("TodayPage.dateNavigation");
  const isMobile = useIsMobile();
  const label = useDayLabel(date, todayDate);
  const time = date === todayDate ? zonedTimeString(now, timeZone) : null;
  const heading = <h1 className="sr-only">{label}</h1>;

  const logButton = onLogEntry ? (
    <Button
      variant="outline"
      size="sm"
      onClick={onLogEntry}
      data-testid="log-entry"
    >
      <PlusIcon data-icon="inline-start" />
      {isMobile ? t("logEntry.shortButton") : t("logEntry.button")}
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <>
        {heading}
        <MobileHeaderTitle>
          <DayPicker
            date={date}
            todayDate={todayDate}
            onChange={onDateChange}
            align="center"
            className="h-9 max-w-full text-base font-semibold tracking-tight"
          />
        </MobileHeaderTitle>
        {time ? (
          <MobileHeaderCenter>
            <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              {time}
            </span>
          </MobileHeaderCenter>
        ) : null}
        <MobileHeaderActions>{logButton}</MobileHeaderActions>
        {progress.total > 0 ? (
          <div className="px-4 pt-3">
            <ProgressMeter progress={progress} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <header className="border-b py-3">
      {heading}
      <div
        className={cn(
          pageWidthVariants(),
          "grid grid-cols-[1fr_auto_1fr] items-center gap-6",
        )}
      >
        <div
          role="group"
          aria-label={tNav("ariaLabel")}
          className="-ml-1.5 flex min-w-0 items-center"
        >
          <DayStepButton
            direction="previous"
            date={date}
            onChange={onDateChange}
            className="w-6"
          />
          <DayPicker
            date={date}
            todayDate={todayDate}
            onChange={onDateChange}
            className="h-8 px-1 text-lg font-semibold tracking-tight"
            suffix={
              time ? (
                <span className="whitespace-nowrap tabular-nums">{time}</span>
              ) : null
            }
          />
          <DayStepButton
            direction="next"
            date={date}
            onChange={onDateChange}
            className="w-6"
          />
        </div>
        <ProgressSummary progress={progress} />
        <div className="justify-self-end">{logButton}</div>
      </div>
    </header>
  );
}
