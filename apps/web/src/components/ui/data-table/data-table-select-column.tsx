"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";

type SelectColumnLabels = {
  selectAll: string;
  selectRow: string;
};

export function createSelectColumn<TData>(
  labels: SelectColumnLabels,
): ColumnDef<TData> {
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
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
          aria-label={labels.selectAll}
        />
      </div>
    ),
    cell: ({ row }) => (
      // The whole cell toggles the row, not just the 16px box — otherwise the
      // padding around a small checkbox is a dead zone that neither checks the
      // row nor opens it.
      <div
        className="flex h-full cursor-pointer items-center justify-center"
        onClick={(event) => {
          event.stopPropagation();
          row.toggleSelected(!row.getIsSelected());
        }}
      >
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value)}
          aria-label={labels.selectRow}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
