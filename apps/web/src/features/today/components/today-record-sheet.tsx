"use client";

import { CheckIcon, CircleAlertIcon, RotateCcwIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { cn } from "@/lib/utils";
import { formatTemperature, formatTimeOfDay } from "../lib/format";
import type { TodayTimelineItem } from "../lib/today-timeline";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TodayTimelineItem;
  currentUserId: string | null;
  isUndoing: boolean;
  onUndo: (item: TodayTimelineItem) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

/** Undo lives here so a mis-tap on the row cannot delete a compliance record. */
export function TodayRecordSheet({
  open,
  onOpenChange,
  item,
  currentUserId,
  isUndoing,
  onUndo,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const timeZone = useOrgTimeZone();
  const { task, isDeviation } = item;
  const reading = task.temperatureReading;

  const userLabel = task.completedBy
    ? task.completedBy.id === currentUserId
      ? t("audit.you")
      : [task.completedBy.firstName, task.completedBy.lastName]
          .filter(Boolean)
          .join(" ") || task.completedBy.id.slice(-6)
    : "—";

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      description={
        <>
          {task.equipmentName ? `${task.equipmentName} · ` : ""}
          {task.scheduledTime}
        </>
      }
      closeLabel={t("record.close")}
      footer={
        // flex-row overrides the base flex-col-reverse: this footer is always a
        // 50/50 row, not just from sm: up.
        <DialogFooter className="flex-row items-center gap-2 md:gap-3">
          <Button
            variant="outline"
            className="min-h-14 flex-1 rounded-2xl md:min-h-10 md:rounded-md"
            onClick={() => onOpenChange(false)}
          >
            {t("record.close")}
          </Button>
          <Button
            variant="destructive"
            className="min-h-14 flex-1 rounded-2xl md:min-h-10 md:rounded-md"
            isLoading={isUndoing}
            onClick={() => onUndo(item)}
          >
            <RotateCcwIcon />
            {t("actions.undo")}
          </Button>
        </DialogFooter>
      }
    >
      <div className="space-y-4">
        {reading ? (
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl px-4 py-5 text-center ring-1",
              isDeviation
                ? "bg-destructive/[0.06] ring-destructive/20"
                : "bg-success/[0.06] ring-success/20",
            )}
          >
            <div className="text-4xl font-semibold tabular-nums">
              {formatTemperature(reading.recordedC, locale)}
              <span className="ml-1 text-2xl text-muted-foreground">°C</span>
            </div>
            <Badge variant={isDeviation ? "destructive" : "success"}>
              {isDeviation ? <CircleAlertIcon /> : <CheckIcon />}
              {isDeviation
                ? t("temperatureDialog.outOfRange")
                : t("temperatureDialog.ok")}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {t("temperatureDialog.allowedRange")}:{" "}
              {formatTemperature(reading.minTempC, locale)} –{" "}
              {formatTemperature(reading.maxTempC, locale)} °C
            </p>
          </div>
        ) : null}

        <div className="divide-y">
          <DetailRow
            label={t("record.completedAt")}
            value={
              task.completedAt ? formatTimeOfDay(task.completedAt, locale, timeZone) : "—"
            }
          />
          <DetailRow label={t("record.completedBy")} value={userLabel} />
          <DetailRow
            label={t("record.taskType")}
            value={t(`taskTypes.${task.type}`)}
          />
        </div>

        {reading?.correctiveAction ? (
          <div className="rounded-lg bg-destructive/[0.06] p-3">
            <p className="text-sm font-medium">{t("audit.correctiveAction")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {reading.correctiveAction}
            </p>
          </div>
        ) : null}
      </div>
    </ResponsiveFormDialog>
  );
}
