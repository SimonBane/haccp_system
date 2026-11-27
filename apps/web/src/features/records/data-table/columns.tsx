"use client";

import type { RecordItem } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRightIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { RecordOutcomeBadge } from "@/features/records/components/record-outcome-badge";
import type { RecordFormat } from "@/features/records/hooks/use-record-format";
import {
  RECORD_OUTCOME,
  recordOutcome,
} from "@/features/records/lib/records-outcome";
import { cn } from "@/lib/utils";

export type RecordsColumnCopy = {
  time: string;
  check: string;
  answers: string;
  recordedBy: string;
  result: string;
  details: string;
  noReading: string;
  notRecorded: string;
  viewRecord: (name: string, time: string) => string;
};

export function getRecordsColumns(input: {
  copy: RecordsColumnCopy;
  format: RecordFormat;
  onOpen: (item: RecordItem) => void;
}): ColumnDef<RecordItem>[] {
  const { copy, format, onOpen } = input;

  return [
    {
      // Time is the only sort: day headings need rows in date order.
      id: "entryAt",
      accessorFn: (row) => `${row.entryDate} ${row.entryTime}`,
      meta: { className: "w-24" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={copy.time} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.entryTime}
        </span>
      ),
    },
    {
      id: "title",
      enableSorting: false,
      header: () => copy.check,
      cell: ({ row }) => {
        const heading = format.heading(row.original);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{heading.primary}</span>
            <span className="text-muted-foreground">{heading.secondary}</span>
          </div>
        );
      },
    },
    {
      id: "answers",
      enableSorting: false,
      header: () => copy.answers,
      cell: ({ row }) => {
        const outcome = recordOutcome(row.original);
        const summary = format.summary(row.original);
        const limits = format.failingLimits(row.original);
        return (
          <div className="flex max-w-72 flex-col">
            <span
              className={cn(
                "line-clamp-2 tabular-nums",
                outcome === RECORD_OUTCOME.ATTENTION &&
                  "font-medium text-destructive",
                (outcome === RECORD_OUTCOME.MISSED ||
                  outcome === RECORD_OUTCOME.VOIDED) &&
                  "text-muted-foreground",
                outcome === RECORD_OUTCOME.VOIDED && "line-through",
              )}
            >
              {summary ?? copy.noReading}
            </span>
            {limits ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {limits}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "recordedBy",
      enableSorting: false,
      header: () => copy.recordedBy,
      cell: ({ row }) => {
        const record = row.original.record;
        if (!record) {
          return (
            <span className="text-muted-foreground">{copy.notRecorded}</span>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback>
                {format.initials(record.recordedBy)}
              </AvatarFallback>
            </Avatar>
            <span>{format.person(record.recordedBy)}</span>
          </div>
        );
      },
    },
    {
      id: "result",
      enableSorting: false,
      header: () => copy.result,
      cell: ({ row }) => <RecordOutcomeBadge item={row.original} />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">{copy.details}</span>,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={copy.viewRecord(
            format.heading(row.original).primary,
            row.original.entryTime,
          )}
          onClick={() => onOpen(row.original)}
        >
          <ChevronRightIcon />
        </Button>
      ),
    },
  ];
}
