"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayWorkspace } from "./today-workspace";

export function TodayPageSkeleton() {
  const t = useTranslations("TodayPage");

  return (
    <TodayWorkspace>
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only">{t("loading")}</span>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-32 sm:h-9" />
              <Skeleton className="hidden h-4 w-52 max-w-full sm:block" />
            </div>
            <div className="flex w-full items-center gap-1 sm:w-fit">
              <Skeleton className="size-11 shrink-0 rounded-md sm:size-9" />
              <Skeleton className="h-11 min-w-0 flex-1 rounded-md sm:h-9 sm:w-36 sm:flex-none" />
              <Skeleton className="size-11 shrink-0 rounded-md sm:size-9" />
            </div>
          </div>
        </div>

        <div className="space-y-2 xl:hidden">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        <div className="hidden grid-cols-4 gap-3 xl:grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-24 items-center gap-3 rounded-xl border bg-background p-4"
            >
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          <div className="space-y-5">
            <div className="hidden space-y-2 md:block">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="size-6 rounded-full" />
            </div>

            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border bg-background px-3.5 py-3 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-5 w-12 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-44 max-w-full" />
                      <Skeleton className="h-3 w-36 max-w-full" />
                    </div>
                  </div>
                  <Skeleton className="h-11 w-full rounded-md sm:h-9 sm:w-28" />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden rounded-xl border bg-background lg:block">
            <div className="flex items-start gap-3 border-b p-5">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 p-5 min-[1400px]:grid-cols-1! 2xl:grid-cols-2!">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </TodayWorkspace>
  );
}
