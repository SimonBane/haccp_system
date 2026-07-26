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
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-52 max-w-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
          </div>

          <div className="overflow-hidden rounded-xl border bg-background xl:hidden">
            <div className="grid grid-cols-3 divide-x">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-3 sm:p-4">
                  <Skeleton className="hidden size-8 rounded-lg sm:block" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t p-3 sm:px-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
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

        <div className="flex items-center gap-3 rounded-xl border bg-background p-3.5 lg:hidden">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
          <Skeleton className="hidden h-8 w-28 sm:block" />
        </div>

        <div className="grid items-start gap-6 min-[1400px]:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          <div className="space-y-5">
            <div className="hidden space-y-2 md:block">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />

            <div className="flex items-center justify-between border-b pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="size-6 rounded-full" />
            </div>

            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border bg-background p-3.5"
              >
                <div className="hidden items-stretch gap-4 md:flex">
                  <Skeleton className="h-20 w-20 rounded-lg" />
                  <div className="flex flex-1 items-center">
                    <div className="w-full space-y-2">
                      <Skeleton className="h-4 w-52 max-w-full" />
                      <Skeleton className="h-3 w-40 max-w-full" />
                    </div>
                  </div>
                  <div className="w-28 space-y-2">
                    <Skeleton className="h-5 w-full rounded-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
                <div className="space-y-3 md:hidden">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-11 w-full" />
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
