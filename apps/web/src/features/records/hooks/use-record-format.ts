"use client";

import {
  addCalendarDays,
  type FormVersionSummaryMap,
  type RecordItem,
  type UserSummary,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  describeAnswers,
  primaryMeasurement,
  summarizeAnswers,
} from "@/features/forms/lib/answer-summary";
import { actorName, formatRecordTimeOfDay } from "@/features/records/lib/format";
import { shortAnswer } from "@/features/records/lib/record-view";
import { recordHeading } from "@/features/records/lib/records-outcome";

function utcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

/** Everything a records row or the record view prints, in the reader's language and the site's zone. */
export function useRecordFormat(input: {
  formVersions: FormVersionSummaryMap;
  today: string;
}) {
  const t = useTranslations("RecordsPage");
  const format = useAnswerFormat();
  const { organization } = useTenant();
  const timeZone = organization.timezone;
  const { formVersions, today } = input;

  return useMemo(() => {
    const locale = format.locale;
    const longDay = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    const shortDay = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    const definitionOf = (item: RecordItem) =>
      formVersions[item.formVersionId]?.definition ?? null;

    const lines = (item: RecordItem) =>
      item.record
        ? describeAnswers(definitionOf(item), item.record.values, format.answers)
        : [];

    return {
      timeZone,
      definitionOf,
      lines,
      heading: (item: RecordItem) => {
        const { primary, secondary } = recordHeading(item);
        return { primary, secondary: secondary ?? t("wholeLocation") };
      },
      summary: (item: RecordItem) => {
        const described = lines(item);
        return described.length === 0 ? null : summarizeAnswers(described);
      },
      /** The allowed range under a failing reading, so the reader sees what it was judged against. */
      failingLimits: (item: RecordItem) => {
        const reading = primaryMeasurement(item.record?.values ?? null);
        if (!reading?.fails) return null;
        const limits = format.limits(
          { min: reading.min, max: reading.max },
          reading.unit,
        );
        return limits ? t("record.allowed", { limits }) : null;
      },
      short: (item: RecordItem) => {
        const answer = shortAnswer(item);
        if (!answer) return null;
        return answer.kind === "reading"
          ? format.measurement(answer.value, answer.unit)
          : t("checklist", { done: answer.done, total: answer.total });
      },
      time: (instant: string) =>
        formatRecordTimeOfDay(instant, locale, timeZone),
      person: (user: UserSummary | null) =>
        actorName(user) ?? t("record.someone"),
      initials: (user: UserSummary | null) =>
        user
          ? `${user.firstName.at(0) ?? ""}${user.lastName.at(0) ?? ""}`.toUpperCase()
          : "",
      longDay: (date: string) => longDay.format(utcDate(date)),
      shortDay: (date: string) => shortDay.format(utcDate(date)),
      /** "Today · Thu, 26 Nov" on a phone: a relative day reads faster than a date. */
      relativeDay: (date: string) => {
        const label = shortDay.format(utcDate(date));
        if (date === today) return t("day.today", { date: label });
        if (date === addCalendarDays(today, -1)) {
          return t("day.yesterday", { date: label });
        }
        return label;
      },
    };
  }, [format, formVersions, t, timeZone, today]);
}

export type RecordFormat = ReturnType<typeof useRecordFormat>;
