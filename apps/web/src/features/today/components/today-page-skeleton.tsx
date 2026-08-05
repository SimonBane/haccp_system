"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function RowSkeleton() {
  return (
    <Card className="gap-0 p-0 shadow-xs">
      <div className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:min-h-16 sm:gap-3.5 sm:px-4">
        <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40 max-w-full" />
          <Skeleton className="h-3 w-24" />
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

/** Mirrors the real timeline so the layout does not shift when data lands. */
export function TodayPageSkeleton() {
  const t = useTranslations("TodayPage");

  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>

      <header className="sticky top-0 z-30 bg-background pt-[env(safe-area-inset-top)] backdrop-blur-xl md:top-2 md:rounded-t-xl supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="ml-auto h-5 w-12" />
        </div>
        <div
          aria-hidden
          className="h-px bg-[linear-gradient(90deg,transparent_0%,var(--border)_6%,var(--border)_94%,transparent_100%)]"
        />
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-16 sm:px-6">
        <GroupSkeleton rows={2} />
        <GroupSkeleton rows={3} />
        <GroupSkeleton rows={1} />
      </div>
    </div>
  );
}
