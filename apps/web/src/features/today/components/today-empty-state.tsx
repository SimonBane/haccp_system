"use client";

import { CalendarCheck2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function TodayEmptyState() {
  const t = useTranslations("TodayPage");

  return (
    <Empty className="border-none px-0 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-full">
          <CalendarCheck2Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
