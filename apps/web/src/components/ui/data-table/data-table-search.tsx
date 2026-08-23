"use client";

import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

type DataTableSearchProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function DataTableSearch({
  value,
  onValueChange,
  placeholder,
  className,
}: DataTableSearchProps) {
  return (
    <SearchInput
      placeholder={placeholder}
      value={value}
      onSearch={onValueChange}
      className={cn("h-(--control-h) w-full bg-card sm:w-[250px]", className)}
    />
  );
}
