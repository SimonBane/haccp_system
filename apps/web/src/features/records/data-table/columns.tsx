"use client";

import type { RecordItem } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import {
  EM_DASH,
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

export type RecordsColumnCopy = {
  dateTime: string;
  task: string;
  status: string;
  timing: string;
  reading: string;
  outcome: string;
  viewDetails: string;
};

type GetColumnsParams = {
  copy: RecordsColumnCopy;
  labels: RecordsLabels;
  locale: string;
  onViewDetails: (item: RecordItem) => void;
};

export function getRecordsColumns({
  copy,
  labels,
  locale,
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
            {row.original.equipmentName ?? labels.type[row.original.type]}
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
        const { displayState, timing } = row.original;

        return showsTiming(displayState, timing) ? (
          <Badge variant={RECORD_TIMING_VARIANT[timing]}>
            {labels.timing[timing]}
          </Badge>
        ) : (
          <span>{EM_DASH}</span>
        );
      },
    },
    {
      id: "reading",
      enableSorting: false,
      meta: { view_label: copy.reading },
      header: () => copy.reading,
      cell: ({ row }) => {
        const reading = recordReading(row.original);

        return (
          <span className="tabular-nums">
            {reading === null
              ? EM_DASH
              : formatTemperatureValue(reading, locale)}
          </span>
        );
      },
    },
    {
      id: "outcome",
      enableSorting: false,
      meta: { view_label: copy.outcome },
      header: () => copy.outcome,
      cell: ({ row }) =>
        hasTemperatureOutcome(row.original) ? (
          <Badge variant={RECORD_RESULT_VARIANT[row.original.result]}>
            {labels.result[row.original.result]}
          </Badge>
        ) : (
          <span>{EM_DASH}</span>
        ),
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
