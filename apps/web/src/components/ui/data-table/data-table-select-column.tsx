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
  /**
   * The row the last plain (unshifted) click landed on. Shift-clicking a second
   * row selects everything between the two. A ref rather than state: the anchor
   * is only ever read from an event handler, so re-rendering the table to
   * remember it would buy nothing.
   */
  anchorRef: RefObject<string | null>;
};

/**
 * Applies one click to the row selection, honouring shift for ranges.
 *
 * The anchor deliberately stays put after a range click, which is what lets you
 * shift-click repeatedly to resize one range instead of walking it forward a
 * row at a time.
 */
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

  // The first click of a run, or a range with nothing to extend from.
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
            // Select-all rewrites the page wholesale, so no row is left that a
            // later shift-click could sensibly extend from.
            anchorRef.current = null;
          }}
          aria-label={labels.selectAll}
        />
      </div>
    ),
    cell: ({ row, table }) => (
      // The whole cell toggles the row, not just the 16px box — otherwise the
      // padding around a small checkbox is a dead zone that neither checks the
      // row nor opens it.
      //
      // This handler is the only place selection is applied. Base UI answers a
      // click (and a Space press) by re-dispatching a bubbling click on the
      // checkbox's hidden input, which is a sibling of the box and so arrives
      // here with the modifier keys intact — also handling `onCheckedChange`
      // would apply the same click twice.
      <div
        className="flex h-full cursor-pointer items-center justify-center select-none"
        onMouseDown={(event) => {
          // Shift-clicking would otherwise drag a text selection across the
          // very rows being selected.
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
          // Stops the box's own click, leaving only the re-dispatched one that
          // reaches the cell; without this a single click would count twice.
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
