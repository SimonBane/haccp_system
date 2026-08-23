"use client";

import { SORT_ORDER } from "@haccp/shared";
import type { Column } from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  InfoIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const description = column.columnDef.meta?.description;
  const [showDescription, setShowDescription] = React.useState(false);

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sortDirection = column.getIsSorted();
  const SortIcon =
    sortDirection === SORT_ORDER.ASC
      ? ArrowUpIcon
      : sortDirection === SORT_ORDER.DESC
        ? ArrowDownIcon
        : ArrowUpDownIcon;

  return (
    <div className={cn("flex items-center gap-1 space-x-2", className)}>
      {description ? (
        <Popover open={showDescription} onOpenChange={setShowDescription}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tabIndex={0}
                className="h-5 w-5"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDescription((current) => !current);
                }}
              />
            }
          >
            <InfoIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            className="p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs text-muted-foreground">{description}</p>
          </PopoverContent>
        </Popover>
      ) : null}
      <Button
        type="button"
        aria-label={
          column.getIsSorted() === SORT_ORDER.DESC
            ? "Sorted descending. Click to sort ascending."
            : column.getIsSorted() === SORT_ORDER.ASC
              ? "Sorted ascending. Click to sort descending."
              : "Not sorted. Click to sort ascending."
        }
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 cursor-pointer data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === SORT_ORDER.ASC)}
      >
        <span>{title}</span>
        <SortIcon
          className={cn(
            "ml-2 h-4 w-4 stroke-muted-foreground transition-opacity",
            sortDirection
              ? "opacity-100 stroke-foreground"
              : "opacity-0 group-hover:opacity-50",
          )}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
