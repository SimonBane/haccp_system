"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.ComponentProps<typeof Input>, "size" | "defaultValue"> {
  value: string;
  onSearch?: (value: string) => void;
  searchIconClassName?: string;
  size?: "sm" | "md";
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      onSearch,
      searchIconClassName,
      placeholder,
      size = "md",
      value,
      onChange,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const t = useTranslations("DataTable");

    const handleSearch = (newValue: string) => {
      onSearch?.(newValue);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      handleSearch(event.target.value);
      onChange?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && onSearch) {
        onSearch(event.currentTarget.value);
      }
      onKeyDown?.(event);
    };

    const showClear = value.trim().length > 0;

    return (
      <div className="relative">
        <SearchIcon
          className={cn(
            "absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            searchIconClassName,
          )}
        />
        <Input
          ref={ref}
          value={value}
          className={cn(
            "w-[250px] pl-9",
            showClear && "pr-9",
            size === "sm" ? "h-8 text-sm" : "h-10",
            className,
          )}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          placeholder={placeholder ?? t("search")}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            aria-label={t("searchClear")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => handleSearch("")}
          >
            <XIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
