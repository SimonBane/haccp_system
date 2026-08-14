"use client";

import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import type { RefObject } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { selectionRangeIds } from "@/components/ui/data-table/selection-range";

type SelectColumnLabels = {
  selectAll: string;
  selectRow: string;
};

type CreateSelectColumnOptions = {
  labels: SelectColumnLabels;
  anchorRef: RefObject<string | null>;
};

function applySelectionClick<TData>(
  table: Table<TData>,
  row: Row<TData>,
  anchorRef: RefObject<string | null>,
  shiftKey: boolean,
) {
  const selected = !row.getIsSelected();
  const rangeIds = shiftKey
    ? selectionRangeIds(table.getRowModel().rows, anchorRef.current, row.id)
    : null;

  if (rangeIds === null) {
    row.toggleSelected(selected);
    anchorRef.current = row.id;
    return;
  }

  table.setRowSelection((previous) => {
    const next = { ...previous };

    for (const id of rangeIds) {
      if (selected) {
        next[id] = true;
      } else {
        delete next[id];
      }
    }

    return next;
  });
}

export function createSelectColumn<TData>({
  labels,
  anchorRef,
}: CreateSelectColumnOptions): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <div className="flex h-full items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(value);
            anchorRef.current = null;
          }}
          aria-label={labels.selectAll}
        />
      </div>
    ),
    cell: ({ row, table }) => (
      <div
        className="flex h-full cursor-pointer items-center justify-center select-none"
        onMouseDown={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          applySelectionClick(table, row, anchorRef, event.shiftKey);
        }}
      >
        <Checkbox
          checked={row.getIsSelected()}
          aria-label={labels.selectRow}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
