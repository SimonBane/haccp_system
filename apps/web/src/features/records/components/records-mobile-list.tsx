"use client";

import type { RecordItem } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordFormat } from "@/features/records/hooks/use-record-format";
import {
  groupRecordsByDay,
  recordCaption,
  RECORD_CAPTION,
  type RecordCaption,
} from "@/features/records/lib/record-view";
import {
  RECORD_OUTCOME,
  RECORD_OUTCOME_VARIANT,
  recordOutcome,
} from "@/features/records/lib/records-outcome";
import { cn } from "@/lib/utils";

type RecordsMobileListProps = {
  items: readonly RecordItem[];
  format: RecordFormat;
  onOpen: (item: RecordItem) => void;
};

export function RecordsMobileList({
  items,
  format,
  onOpen,
}: RecordsMobileListProps) {
  const t = useTranslations("RecordsPage");

  return (
    <div className="flex flex-col gap-4">
      {groupRecordsByDay(items).map((day) => {
        const parts = [
          ...(day.attention > 0
            ? [t("day.attention", { count: day.attention })]
            : []),
          ...(day.missed > 0 ? [t("day.missed", { count: day.missed })] : []),
          ...(day.open > 0 ? [t("day.open", { count: day.open })] : []),
        ];

        return (
          <section key={day.date} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="text-sm font-semibold">
                {format.relativeDay(day.date)}
              </h2>
              <span className="text-xs text-muted-foreground">
                {parts.length > 0 ? parts.join(" · ") : t("day.allWithinLimits")}
              </span>
            </div>
            <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
              {day.items.map((item) => (
                <li key={item.id}>
                  <MobileRow item={item} format={format} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MobileRow({
  item,
  format,
  onOpen,
}: {
  item: RecordItem;
  format: RecordFormat;
  onOpen: (item: RecordItem) => void;
}) {
  const t = useTranslations("RecordsPage");
  const heading = format.heading(item);
  const outcome = recordOutcome(item);
  const short = format.short(item);
  const caption = captionText(recordCaption(item), format, t);
  const status = t(`outcome.${outcome}`);

  return (
    <Button
      type="button"
      variant="ghost"
      data-row-key={item.id}
      onClick={() => onOpen(item)}
      aria-label={`${heading.primary}, ${heading.secondary}, ${item.entryTime}, ${status}`}
      // Button wraps its children in a span; it is the row's real layout box.
      className="h-auto min-h-16 w-full justify-start rounded-none px-3.5 py-3 text-left font-normal whitespace-normal [&>span]:w-full [&>span]:items-start [&>span]:gap-3"
    >
      <span className="w-10 flex-none font-medium tabular-nums">
        {item.entryTime}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{heading.primary}</span>
        <span className="text-xs text-muted-foreground">
          {heading.secondary}
        </span>
        {caption ? (
          <span className="text-xs text-muted-foreground">{caption}</span>
        ) : null}
      </span>
      <span className="flex max-w-38 flex-none flex-col items-end gap-1 text-right">
        {short ? (
          <span
            className={cn(
              "font-medium tabular-nums",
              outcome === RECORD_OUTCOME.ATTENTION &&
                "font-semibold text-destructive",
              outcome === RECORD_OUTCOME.VOIDED &&
                "font-normal text-muted-foreground line-through",
            )}
          >
            {short}
          </span>
        ) : null}
        <Badge variant={RECORD_OUTCOME_VARIANT[outcome]}>{status}</Badge>
      </span>
    </Button>
  );
}

function captionText(
  caption: RecordCaption | null,
  format: RecordFormat,
  t: ReturnType<typeof useTranslations<"RecordsPage">>,
): string | null {
  if (!caption) return null;
  switch (caption.kind) {
    case RECORD_CAPTION.WAS_DUE:
      return t("caption.wasDue", { time: format.time(caption.at) });
    case RECORD_CAPTION.CORRECTIVE_ACTION:
      return t("caption.correctiveAction");
    case RECORD_CAPTION.LATE:
      return t("caption.late", { minutes: caption.minutes });
  }
}
