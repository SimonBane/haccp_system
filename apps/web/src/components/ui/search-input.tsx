"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.ComponentProps<typeof InputGroupInput>, "size" | "defaultValue"> {
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
      <InputGroup
        className={cn(
          "w-[250px]",
          size === "sm" ? "h-8" : "h-(--control-h)",
          className,
        )}
      >
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <SearchIcon className={searchIconClassName} />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          ref={ref}
          value={value}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          placeholder={placeholder ?? t("search")}
          {...props}
        />
        {showClear ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label={t("searchClear")}
              onClick={() => handleSearch("")}
            >
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    );
  },
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
