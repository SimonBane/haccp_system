"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2Icon,
  LayoutGridIcon,
  ListTodoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TodayFilter, TodayFilterCounts } from "../lib/today-grouping";

type Props = {
  value: TodayFilter;
  onChange: (filter: TodayFilter) => void;
  counts: TodayFilterCounts;
};

const FILTERS: TodayFilter[] = ["todo", "attention", "completed", "all"];

const FILTER_ICONS: Record<TodayFilter, LucideIcon> = {
  todo: ListTodoIcon,
  attention: TriangleAlertIcon,
  completed: CheckCircle2Icon,
  all: LayoutGridIcon,
};

export function TodayFilters({ value, onChange, counts }: Props) {
  const t = useTranslations("TodayPage");

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => {
        if (typeof nextValue === "string") {
          onChange(nextValue as TodayFilter);
        }
      }}
    >
      <TabsList
        aria-label={t("filters.ariaLabel")}
        className="grid h-10 w-full grid-cols-4 p-1"
      >
        {FILTERS.map((filter) => {
          const label = t(`filters.${filter}`);
          const count = counts[filter];
          const Icon = FILTER_ICONS[filter];

          return (
            <TabsTrigger
              key={filter}
              value={filter}
              className="group min-w-0 px-1.5 sm:justify-between sm:px-3"
            >
              <span className="flex min-w-0 items-center justify-center gap-1.5 sm:justify-start">
                <Icon
                  data-icon="inline-start"
                  className="hidden shrink-0 sm:block"
                />
                <span className="truncate text-[11px] sm:hidden">
                  {t(`filtersShort.${filter}`)}
                </span>
                <span className="hidden truncate text-sm sm:inline">
                  {label}
                </span>
              </span>
              <Badge
                variant="secondary"
                className="hidden min-w-5 px-1 text-[10px] tabular-nums sm:inline-flex sm:text-xs group-data-active:bg-background"
              >
                {count}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
