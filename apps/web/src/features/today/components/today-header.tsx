"use client";

import { zonedTimeString } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  MobileHeaderActions,
  MobileHeaderLead,
  MobileHeaderTitle,
} from "@/components/layout/shell-slots";
import { pageWidthVariants } from "@/components/layout/page-container";
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  type TooltipPayloadEntry,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatShortDate } from "../lib/format";
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

const PROGRESS_STATUSES = ["passed", "deviations", "remaining"] as const;
const PROGRESS_ID = "today-progress";
// The chart is taller than the 8px bar so the hover target is easier to hit.
const BAR_SIZE = { width: 128, height: 24 };
const BAR_MARGIN = { top: 8, right: 0, bottom: 8, left: 0 };
const BAR_TOOLTIP_POSITION = { x: 0, y: 28 };
const RING_SIZE = { width: 28, height: 28 };
const RING_TOOLTIP_POSITION = { x: 0, y: 36 };

/** What both progress charts share: their colours and the breakdown popup. */
function useProgressBreakdown(progress: Progress) {
  const t = useTranslations("TodayPage.progress");
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
  const rows: TooltipPayloadEntry[] = PROGRESS_STATUSES.map((status) => ({
    graphicalItemId: PROGRESS_ID,
    name: status,
    dataKey: status,
    value: counts[status],
    payload: { status, fill: `var(--color-${status})` },
  }));
  const summary = t("short", {
    completed: progress.done,
    total: progress.total,
  });

  function tooltip(open: boolean, position: { x: number; y: number }) {
    return (
      <ChartTooltip
        active={open}
        // Recharts hides a tooltip with no payload of its own.
        defaultIndex={0}
        cursor={false}
        position={position}
        isAnimationActive={false}
        allowEscapeViewBox={{ x: true, y: true }}
        wrapperStyle={{ zIndex: 50 }}
        content={({ active }) => (
          <ChartTooltipContent
            active={active}
            payload={rows}
            nameKey="status"
            labelFormatter={() => summary}
            className="min-w-44 gap-2 px-3 py-2.5 text-sm [&_.grid]:gap-2 [&_[style*='--color-bg']]:size-3"
          />
        )}
      />
    );
  }

  return { counts, config, summary, tooltip };
}

function ProgressBar({
  progress,
  open,
}: {
  progress: Progress;
  open: boolean;
}) {
  const { counts, config, tooltip } = useProgressBreakdown(progress);

  return (
    <ChartContainer
      config={config}
      initialDimension={BAR_SIZE}
      aria-hidden
      className="aspect-auto h-6 w-32 shrink-0 [&_.recharts-surface]:[clip-path:inset(8px_0_round_9999px)]"
    >
      <BarChart
        data={[counts]}
        layout="vertical"
        margin={BAR_MARGIN}
        barCategoryGap={0}
      >
        <XAxis type="number" hide domain={[0, progress.total]} />
        <YAxis type="category" hide />
        {tooltip(open, BAR_TOOLTIP_POSITION)}
        {PROGRESS_STATUSES.map((status) => (
          <Bar
            key={status}
            id={status === "passed" ? PROGRESS_ID : undefined}
            dataKey={status}
            stackId="progress"
            fill={`var(--color-${status})`}
            // Hover state re-renders the chart, which would replay the grow each time.
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function ProgressRing({
  progress,
  open,
}: {
  progress: Progress;
  open: boolean;
}) {
  const { counts, config, tooltip } = useProgressBreakdown(progress);
  const data = PROGRESS_STATUSES.filter((status) => counts[status] > 0).map(
    (status) => ({
      status,
      count: counts[status],
      fill: `var(--color-${status})`,
    }),
  );

  return (
    <ChartContainer
      config={config}
      initialDimension={RING_SIZE}
      aria-hidden
      className="aspect-square size-7 shrink-0"
    >
      <PieChart>
        {tooltip(open, RING_TOOLTIP_POSITION)}
        <Pie
          id={PROGRESS_ID}
          data={data}
          // Open state re-renders the chart, which would replay the sweep each time.
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

/** A tap opens the breakdown; a tap anywhere else or Escape closes it. */
function ProgressRingButton({ progress }: { progress: Progress }) {
  const t = useTranslations("TodayPage.progress");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (progress.total === 0) return null;

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label={t("short", {
        completed: progress.done,
        total: progress.total,
      })}
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      data-testid="today-progress-ring"
    >
      <ProgressRing progress={progress} open={open} />
    </Button>
  );
}

/** The bar and its count are one hover target for the breakdown. */
function ProgressSummary({ progress }: { progress: Progress }) {
  const t = useTranslations("TodayPage.progress");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // An empty element still holds the header's middle column.
  if (progress.total === 0) return <div />;

  const summary = t("short", {
    completed: progress.done,
    total: progress.total,
  });

  return (
    <div
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
      className="flex cursor-default items-center gap-2.5 rounded-md px-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ProgressBar progress={progress} open={hovered || focused} />
      <span
        aria-hidden
        className="text-sm font-semibold whitespace-nowrap tabular-nums"
      >
        {summary}
      </span>
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
  const locale = useLocale();
  const isMobile = useIsMobile();
  const label = useDayLabel(date, todayDate);
  const time = date === todayDate ? zonedTimeString(now, timeZone) : null;
  const heading = <h1 className="sr-only">{label}</h1>;
  const timeLabel = time ? (
    <span className="whitespace-nowrap tabular-nums">{time}</span>
  ) : null;

  const logButton = onLogEntry ? (
    isMobile ? (
      <Button
        variant="outline"
        size="icon"
        aria-label={t("logEntry.button")}
        onClick={onLogEntry}
        data-testid="log-entry"
      >
        <PlusIcon />
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        onClick={onLogEntry}
        data-testid="log-entry"
      >
        <PlusIcon data-icon="inline-start" />
        {t("logEntry.button")}
      </Button>
    )
  ) : null;

  if (isMobile) {
    return (
      <>
        {heading}
        <MobileHeaderLead>
          <ProgressRingButton progress={progress} />
        </MobileHeaderLead>
        <MobileHeaderTitle>
          <DayPicker
            date={date}
            todayDate={todayDate}
            onChange={onDateChange}
            align="center"
            label={formatShortDate(date, locale)}
            className="h-9 max-w-full text-base font-semibold tracking-tight"
            suffix={timeLabel}
          />
        </MobileHeaderTitle>
        <MobileHeaderActions>{logButton}</MobileHeaderActions>
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
            suffix={timeLabel}
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
