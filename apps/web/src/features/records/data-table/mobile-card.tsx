"use client";

import type { RecordItem } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import {
  formatOccurrenceDate,
  formatTemperatureValue,
  hasTemperatureOutcome,
  recordReading,
} from "@/features/records/lib/format";
import {
  RECORD_DISPLAY_STATE_VARIANT,
  RECORD_RESULT_VARIANT,
  RECORD_TIMING_VARIANT,
  showsTiming,
  type RecordsLabels,
} from "@/features/records/lib/labels";

type RecordsMobileCardProps = {
  row: Row<RecordItem>;
  labels: RecordsLabels;
  locale: string;
};

export function RecordsMobileCard({
  row,
  labels,
  locale,
}: RecordsMobileCardProps) {
  const item = row.original;
  const reading = recordReading(item);

  return (
    <MobileListRow
      variant="card"
      title={item.title}
      subtitle={item.equipmentName ?? labels.type[item.type]}
      trailing={
        reading === null ? null : (
          <span className="tabular-nums">
            {formatTemperatureValue(reading, locale)}
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
          {showsTiming(item.displayState, item.timing) ? (
            <Badge variant={RECORD_TIMING_VARIANT[item.timing]}>
              {labels.timing[item.timing]}
            </Badge>
          ) : null}
          {hasTemperatureOutcome(item) ? (
            <Badge variant={RECORD_RESULT_VARIANT[item.result]}>
              {labels.result[item.result]}
            </Badge>
          ) : null}
        </div>
      }
    />
  );
}
