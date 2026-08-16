"use client";

import { useTranslations } from "next-intl";
import { pageWidthVariants } from "@/components/layout/page-container";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function RowSkeleton() {
  return (
    <Card className="gap-0 p-0 shadow-xs">
      <div className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:min-h-16 sm:gap-3.5 sm:px-4">
        <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40 max-w-full" />
          <Skeleton className="h-5 w-32 rounded-4xl" />
        </div>
        <Skeleton className="hidden h-6 w-20 rounded-md sm:block" />
      </div>
    </Card>
  );
}

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <section className="relative pb-2 pl-9 sm:pl-11">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[13px] w-px -translate-x-1/2 bg-border sm:left-[15px]"
      />
      <span
        aria-hidden
        className="absolute top-[15px] left-[13px] size-3.5 -translate-x-1/2 rounded-full bg-muted ring-4 ring-background sm:left-[15px]"
      />
      <div className="flex items-center gap-2.5 py-2">
        <Skeleton className="h-4 w-11" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2 pt-0.5 pb-1">
        {Array.from({ length: rows }, (_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export function TodayPageSkeleton() {
  const t = useTranslations("TodayPage");

  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <header className="sticky top-0 z-30 bg-background backdrop-blur-xl md:rounded-t-xl supports-[backdrop-filter]:bg-background/85">
        <div
          className={cn(
            pageWidthVariants({ width: "narrow" }),
            "flex items-center gap-2 py-2.5",
          )}
        >
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="ml-auto h-5 w-12" />
        </div>
        <div
          aria-hidden
          className="h-px bg-[linear-gradient(90deg,transparent_0%,var(--border)_6%,var(--border)_94%,transparent_100%)]"
        />
      </header>

      <div
        className={cn(pageWidthVariants({ width: "narrow" }), "pt-4 pb-16")}
      >
        <GroupSkeleton rows={2} />
        <GroupSkeleton rows={3} />
        <GroupSkeleton rows={1} />
      </div>
    </div>
  );
}
