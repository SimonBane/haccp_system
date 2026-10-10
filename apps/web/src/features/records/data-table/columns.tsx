"use client";

import type { RecordItem } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
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

export type RecordsColumnCopy = {
  dateTime: string;
  task: string;
  status: string;
  timing: string;
  answers: string;
  result: string;
  viewDetails: string;
};

/** One line of a record's answers, or null when there is no record. */
export type SummarizeRecord = (item: RecordItem) => string | null;

type GetColumnsParams = {
  copy: RecordsColumnCopy;
  labels: RecordsLabels;
  summarize: SummarizeRecord;
  onViewDetails: (item: RecordItem) => void;
};

export function getRecordsColumns({
  copy,
  labels,
  summarize,
  onViewDetails,
}: GetColumnsParams): ColumnDef<RecordItem>[] {
  return [
    {
      // Ids of sortable columns must match the API sort allowlist exactly.
      id: "scheduledAt",
      accessorFn: (row) => `${row.occurrenceDate} ${row.scheduledTime}`,
      enableHiding: false,
      meta: { view_label: copy.dateTime },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={copy.dateTime} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>
            {formatOccurrenceDate(row.original.occurrenceDate)}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {row.original.scheduledTime}
          </span>
        </div>
      ),
    },
    {
      id: "title",
      accessorFn: (row) => row.title,
      enableHiding: false,
      meta: { view_label: copy.task },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={copy.task} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
          <span className="text-muted-foreground">
            {row.original.targetName ?? labels.category[row.original.category]}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      enableSorting: false,
      meta: { view_label: copy.status },
      header: () => copy.status,
      cell: ({ row }) => (
        <Badge variant={RECORD_DISPLAY_STATE_VARIANT[row.original.displayState]}>
          {labels.displayState[row.original.displayState]}
        </Badge>
      ),
    },
    {
      id: "timing",
      enableSorting: false,
      meta: { view_label: copy.timing },
      header: () => copy.timing,
      cell: ({ row }) => {
        const timing = timingBadgeValue(row.original);

        return timing ? (
          <Badge variant={RECORD_TIMING_VARIANT[timing]}>
            {labels.timing[timing]}
          </Badge>
        ) : null;
      },
    },
    {
      id: "answers",
      enableSorting: false,
      meta: { view_label: copy.answers },
      header: () => copy.answers,
      cell: ({ row }) => {
        const summary = summarize(row.original);

        return summary === null ? null : (
          <span className="line-clamp-2 max-w-72 tabular-nums">{summary}</span>
        );
      },
    },
    {
      id: "result",
      enableSorting: false,
      meta: { view_label: copy.result },
      header: () => copy.result,
      cell: ({ row }) =>
        hasJudgedResult(row.original) ? (
          <Badge variant={RECORD_RESULT_VARIANT[row.original.result]}>
            {labels.result[row.original.result]}
          </Badge>
        ) : null,
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={copy.viewDetails}
          onClick={() => onViewDetails(row.original)}
        >
          <EyeIcon />
        </Button>
      ),
    },
  ];
}
