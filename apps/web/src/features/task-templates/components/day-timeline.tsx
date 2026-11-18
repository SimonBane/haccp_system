import { buildTimeline } from "@/features/task-templates/lib/schedule";
import { cn } from "@/lib/utils";

type Window = { opensBefore: number; dueAfter: number | null };

/** Hour labels fit only every 6 h in a narrow column; the day plan has room for every 3 h. */
export const HOUR_MARKS = {
  compact: [0, 6, 12, 18, 24],
  wide: [0, 3, 6, 9, 12, 15, 18, 21, 24],
} as const;

function percent(hour: number): string {
  return `${(hour / 24) * 100}%`;
}

export function HourRuler({ hours }: { hours: readonly number[] }) {
  return (
    <div className="relative h-4" aria-hidden>
      {hours.map((hour, index) => (
        <span
          key={hour}
          className={cn(
            "absolute top-0 text-[11px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums",
            index === 0 ? "" : index === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
          )}
          style={{ left: percent(hour) }}
        >
          {`${String(hour).padStart(2, "0")}:00`}
        </span>
      ))}
    </div>
  );
}

/** A 24 h strip: a dot per check, a shaded bar per window, or a grey band when there is no window. */
export function DayStrip({
  times,
  window,
  label,
  gridHours,
  className,
}: {
  times: readonly string[];
  window: Window | null;
  label: string;
  gridHours: readonly number[];
  className?: string;
}) {
  const { marks, bars } = buildTimeline(times, window);

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative h-8 rounded-md bg-muted", className)}
    >
      {gridHours.slice(1, -1).map((hour) => (
        <span
          key={hour}
          className="absolute inset-y-0 w-px bg-foreground/10"
          style={{ left: percent(hour) }}
        />
      ))}
      {!window && times.length > 0 ? (
        <span className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-sm bg-muted-foreground/25" />
      ) : null}
      {bars.map((bar, index) => (
        <span
          key={index}
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-primary/25"
          style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
        />
      ))}
      {marks.map((mark) => (
        <span
          key={mark.time}
          title={mark.time}
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
          style={{ left: `${mark.left}%` }}
        />
      ))}
    </div>
  );
}

export function TimelineLegend({
  check,
  window,
  anyTime,
}: {
  check: string;
  window: string;
  anyTime: string;
}) {
  return (
    <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-primary" aria-hidden />
        {check}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm bg-primary/25" aria-hidden />
        {window}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-sm bg-muted-foreground/25" aria-hidden />
        {anyTime}
      </span>
    </div>
  );
}
