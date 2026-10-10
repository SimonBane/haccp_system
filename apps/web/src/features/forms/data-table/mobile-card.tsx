"use client";

import type { FormCategory, FormResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";

type FormsTranslations = ReturnType<typeof useTranslations<"FormsPage">>;

type FormsMobileCardProps = {
  row: Row<FormResponse>;
  t: FormsTranslations;
  categoryLabels: Record<FormCategory, string>;
};

export function FormsMobileCard({
  row,
  t,
  categoryLabels,
}: FormsMobileCardProps) {
  const form = row.original;
  const Icon = FORM_CATEGORY_ICONS[form.category];

  return (
    <MobileListRow
      leading={<Icon className="size-5 text-muted-foreground" aria-hidden />}
      title={form.name}
      subtitle={`${categoryLabels[form.category]} · ${t("fieldCount", {
        count: form.latestVersion.definition.fields.length,
      })}`}
      trailing={
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("versionBadge", { version: form.latestVersion.version })}
        </span>
      }
    />
  );
}
