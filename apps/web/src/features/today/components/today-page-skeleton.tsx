"use client";

import { useTranslations } from "next-intl";
import { pageWidthVariants } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PANEL_COLUMN_CLASS } from "./check-panel";

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      <div className="flex items-center px-4 pt-3 pb-2.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="ml-auto h-3.5 w-14" />
      </div>
      <div className="divide-y border-t">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex min-h-15 items-center gap-3.5 px-4">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-44 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TodayPageSkeleton() {
  const t = useTranslations("TodayPage");

  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <div className="hidden border-b py-4 md:block">
        <div
          className={cn(
            pageWidthVariants(),
            "grid grid-cols-[1fr_auto_1fr] items-center gap-6",
          )}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="h-9 w-44 rounded-[10px]" />
          <Skeleton className="h-9 w-32 justify-self-end" />
        </div>
      </div>

      <div
        className={cn(
          pageWidthVariants(),
          "flex flex-col gap-6 pt-4 pb-16 md:pt-6 xl:flex-row xl:items-start",
        )}
      >
        <div className="flex min-w-0 flex-col gap-5 xl:flex-1">
          <Skeleton className="h-11 w-full rounded-[10px] md:hidden" />
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={3} />
        </div>
        <Skeleton
          className={cn("hidden h-96 rounded-2xl xl:block", PANEL_COLUMN_CLASS)}
        />
      </div>
    </div>
  );
}
