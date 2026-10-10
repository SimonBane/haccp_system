"use client";

import type { RecordItem } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import type { SummarizeRecord } from "@/features/records/data-table/columns";
import {
  formatOccurrenceDate,
  hasJudgedResult,
} from "@/features/records/lib/format";
import {
  RECORD_DISPLAY_STATE_VARIANT,
  RECORD_RESULT_VARIANT,
  RECORD_TIMING_VARIANT,
  timingBadgeValue,
  type RecordsLabels,
} from "@/features/records/lib/labels";

type RecordsMobileCardProps = {
  row: Row<RecordItem>;
  labels: RecordsLabels;
  summarize: SummarizeRecord;
};

export function RecordsMobileCard({
  row,
  labels,
  summarize,
}: RecordsMobileCardProps) {
  const item = row.original;
  const summary = summarize(item);
  const timing = timingBadgeValue(item);

  return (
    <MobileListRow
      variant="card"
      title={item.title}
      subtitle={item.targetName ?? labels.category[item.category]}
      trailing={
        summary === null ? null : (
          <span className="line-clamp-2 max-w-40 text-right tabular-nums">
            {summary}
          </span>
        )
      }
      details={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatOccurrenceDate(item.occurrenceDate)} ·{" "}
            {item.scheduledTime}
          </span>
          <Badge variant={RECORD_DISPLAY_STATE_VARIANT[item.displayState]}>
            {labels.displayState[item.displayState]}
          </Badge>
          {timing ? (
            <Badge variant={RECORD_TIMING_VARIANT[timing]}>
              {labels.timing[timing]}
            </Badge>
          ) : null}
          {hasJudgedResult(item) ? (
            <Badge variant={RECORD_RESULT_VARIANT[item.result]}>
              {labels.result[item.result]}
            </Badge>
          ) : null}
        </div>
      }
    />
  );
}
