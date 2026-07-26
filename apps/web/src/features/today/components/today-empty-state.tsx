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
    <Empty className="items-start border-none p-0 py-8">
      <EmptyHeader className="max-w-md items-start text-left">
        <EmptyMedia variant="icon">
          <CalendarCheck2Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-base">{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
