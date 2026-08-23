"use client";

import { CheckIcon, FilterIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type DataTableFilterOption = {
  value: string;
  label: string;
};

export type DataTableFilterDefinition = {
  key: string;
  label: string;
  options: DataTableFilterOption[];
  searchable?: boolean;
};

type DataTableFilterProps = {
  definition: DataTableFilterDefinition;
  values: string[];
  onChange: (values: string[]) => void;
};

export function DataTableFilter({
  definition,
  values,
  onChange,
}: DataTableFilterProps) {
  const t = useTranslations("DataTable.filters");
  const [optionSearch, setOptionSearch] = useState("");
  const selected = useMemo(() => new Set(values), [values]);

  const visibleOptions = useMemo(() => {
    const term = optionSearch.trim().toLowerCase();
    if (!definition.searchable || term === "") {
      return definition.options;
    }

    return definition.options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [definition.options, definition.searchable, optionSearch]);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange([...next]);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-dashed bg-card"
            aria-label={t("filterBy", { name: definition.label })}
          />
        }
      >
        <FilterIcon />
        {definition.label}
        {selected.size > 0 ? (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selected.size}
            </Badge>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-2 p-2">
        {definition.searchable ? (
          <SearchInput
            size="sm"
            className="w-full"
            placeholder={t("searchOptions")}
            value={optionSearch}
            onSearch={setOptionSearch}
          />
        ) : null}

        <div
          role="group"
          aria-label={definition.label}
          className="flex max-h-64 flex-col overflow-y-auto"
        >
          {visibleOptions.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("noOptions")}
            </p>
          ) : (
            visibleOptions.map((option) => {
              const isSelected = selected.has(option.value);

              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  role="checkbox"
                  aria-checked={isSelected}
                  className="h-8 justify-start gap-2 px-2 font-normal"
                  onClick={() => toggle(option.value)}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                      isSelected && "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {isSelected ? <CheckIcon className="size-3" /> : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </Button>
              );
            })
          )}
        </div>

        {selected.size > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-center"
            onClick={() => onChange([])}
          >
            {t("clear")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

type DataTableFilterBarProps = {
  definitions: DataTableFilterDefinition[];
  values: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  onClearAll: () => void;
};

export function DataTableFilterBar({
  definitions,
  values,
  onChange,
  onClearAll,
}: DataTableFilterBarProps) {
  const t = useTranslations("DataTable.filters");
  const hasActiveFilter = definitions.some(
    (definition) => (values[definition.key] ?? []).length > 0,
  );

  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {definitions.map((definition) => (
        <DataTableFilter
          key={definition.key}
          definition={definition}
          values={values[definition.key] ?? []}
          onChange={(next) => onChange(definition.key, next)}
        />
      ))}

      {hasActiveFilter ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          onClick={onClearAll}
        >
          <XIcon />
          {t("clearAll")}
        </Button>
      ) : null}
    </div>
  );
}
