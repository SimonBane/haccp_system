"use client";

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
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const description = column.columnDef.meta?.description;
  const [showDescription, setShowDescription] = React.useState(false);
  const sortDirection = column.getIsSorted();
  const SortIcon =
    sortDirection === "asc"
      ? ArrowUpIcon
      : sortDirection === "desc"
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
          column.getIsSorted() === "desc"
            ? "Sorted descending. Click to sort ascending."
            : column.getIsSorted() === "asc"
              ? "Sorted ascending. Click to sort descending."
              : "Not sorted. Click to sort ascending."
        }
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 cursor-pointer data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
