"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatScheduleSummary } from "@/features/task-templates/lib/format-schedule";
import { TaskTemplatesTableRowActions } from "@/features/task-templates/data-table/row-actions";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type TaskTemplatesMobileCardProps = {
  row: Row<TaskTemplateResponse>;
  t: TasksTranslations;
  typeLabels: Record<TaskTemplateType, string>;
  scheduleLabels: {
    everyDay: string;
    monFri: string;
    formatShort: (
      weekday: import("@haccp/shared").TaskTemplateWeekday,
    ) => string;
  };
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function TaskTemplatesMobileCard({
  row,
  t,
  typeLabels,
  scheduleLabels,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskTemplatesMobileCardProps) {
  const task = row.original;

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{typeLabels[task.type]}</Badge>
        </div>
        <p className="text-muted-foreground">
          {formatScheduleSummary(
            task.weekdays,
            task.scheduledTimes,
            scheduleLabels,
          )}
        </p>
        {task.equipmentName ? (
          <p className="text-muted-foreground">{task.equipmentName}</p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end border-t pt-3">
        <TaskTemplatesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </CardFooter>
    </Card>
  );
}
