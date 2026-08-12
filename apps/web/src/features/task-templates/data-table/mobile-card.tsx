"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { ClipboardCheckIcon, ThermometerIcon } from "lucide-react";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { formatWeekdaysLabel } from "@/features/task-templates/lib/format-schedule";

type TaskTemplatesMobileRowProps = {
  row: Row<TaskTemplateResponse>;
  typeLabels: Record<TaskTemplateType, string>;
  scheduleLabels: {
    everyDay: string;
    weekdays: string;
    formatShort: (
      weekday: import("@haccp/shared").TaskTemplateWeekday,
    ) => string;
  };
};

/**
 * The card variant, because a task template does not fit on one line.
 *
 * The times used to sit in the trailing slot as one comma-joined string, which
 * on a template with four of them took most of the row and truncated the title
 * and the equipment it applies to. They are their own wrapping row of chips
 * now, under a title and subtitle that get the full width.
 */
export function TaskTemplatesMobileCard({
  row,
  typeLabels,
  scheduleLabels,
}: TaskTemplatesMobileRowProps) {
  const task = row.original;

  // Weekdays only. `formatScheduleSummary` appends the times, which is exactly
  // the part that overflowed — they are chips of their own below.
  const weekdays = formatWeekdaysLabel(task.weekdays, scheduleLabels);

  const detail = [
    typeLabels[task.type],
    weekdays,
    task.type === "temperature" ? task.equipmentName : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MobileListRow
      variant="card"
      leading={
        task.type === "temperature" ? (
          <ThermometerIcon
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <ClipboardCheckIcon
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        )
      }
      title={task.title}
      subtitle={detail}
      details={
        <div className="flex flex-wrap gap-1.5">
          {task.scheduledTimes.map((time) => (
            <span
              key={time}
              className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
            >
              {time}
            </span>
          ))}
        </div>
      }
    />
  );
}
