"use client";

import type { Table } from "@tanstack/react-table";
import { useRef, useState } from "react";
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
  const externalValue =
    (table.getColumn(column)?.getFilterValue() as string) ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? externalValue;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handleSearch = (newValue: string) => {
    setDraft(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (newValue === "") {
      table.getColumn(column)?.setFilterValue("");
      setDraft(null);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      table.getColumn(column)?.setFilterValue(newValue);
      setDraft(null);
      timeoutRef.current = undefined;
    }, 350);
  };

  return (
    <SearchInput
      placeholder={placeholder}
      value={value}
      onSearch={handleSearch}
      className={cn("h-(--control-h) w-full bg-card sm:w-[250px]", className)}
    />
  );
}
