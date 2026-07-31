"use client";

import type { Table } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

type DataTableSearchProps<TData> = {
  table: Table<TData>;
  column: string;
  placeholder: string;
  className?: string;
};

export function DataTableSearch<TData>({
  table,
  placeholder,
  column,
  className,
}: DataTableSearchProps<TData>) {
  const [value, setValue] = useState<string>(
    (table.getColumn(column)?.getFilterValue() as string) ?? "",
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    const filterValue = table.getColumn(column)?.getFilterValue() as string;
    setValue(filterValue ?? "");
  }, [table, column, table.getState().columnFilters]);

  const handleSearch = (newValue: string) => {
    setValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (newValue === "") {
      table.getColumn(column)?.setFilterValue("");
      return;
    }

    timeoutRef.current = setTimeout(() => {
      table.getColumn(column)?.setFilterValue(newValue);
    }, 350);
  };

  return (
    <SearchInput
      placeholder={placeholder}
      value={value}
      onSearch={handleSearch}
      className={cn("h-9 w-full bg-card sm:w-[250px]", className)}
    />
  );
}
