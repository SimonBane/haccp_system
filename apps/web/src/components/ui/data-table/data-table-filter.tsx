"use client";

import { FilterIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";

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

type DataTableFilterMenuItemProps = {
  definition: DataTableFilterDefinition;
  values: string[];
  onChange: (values: string[]) => void;
};

/** A single filter dimension inside the menu — hovering it opens its option list. */
function DataTableFilterMenuItem({
  definition,
  values,
  onChange,
}: DataTableFilterMenuItemProps) {
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
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="whitespace-nowrap">
        <FilterIcon className="text-muted-foreground" />
        <span className="flex-1">{definition.label}</span>
        {selected.size > 0 ? (
          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
            {selected.size}
          </Badge>
        ) : null}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-fit min-w-0 gap-1 p-2">
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
              visibleOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  className="whitespace-nowrap"
                  checked={selected.has(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
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
  const activeCount = definitions.reduce(
    (sum, definition) => sum + (values[definition.key] ?? []).length,
    0,
  );

  if (definitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-dashed bg-card"
              aria-label={t("label")}
            />
          }
        >
          <FilterIcon />
          {t("label")}
          {activeCount > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {activeCount}
              </Badge>
            </>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-fit min-w-0">
          {definitions.map((definition) => (
            <DataTableFilterMenuItem
              key={definition.key}
              definition={definition}
              values={values[definition.key] ?? []}
              onChange={(next) => onChange(definition.key, next)}
            />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeCount > 0 ? (
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
