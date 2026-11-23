"use client";

import {
  FORM_CATEGORY_VALUES,
  getStarterForms,
  type FormCategory,
  type LibraryLocale,
  type StarterForm,
} from "@haccp/shared";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS, FORM_CATEGORY_ICONS } from "../../lib/category-icon";

type Props = {
  onPick: (source: StarterForm | null) => void;
};

type Filter = FormCategory | "all";

const CHIP_CLASS =
  "h-9 rounded-full border border-input px-3 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground max-md:h-11";

const CARD_CLASS =
  "h-auto w-full rounded-xl bg-card text-left font-normal whitespace-normal shadow-xs ring-1 ring-foreground/10 transition-shadow hover:bg-card hover:shadow-md hover:ring-foreground/20 [&>span]:w-full";

/** Starter forms are copied into the organisation, in the admin's language, and are theirs to change. */
export function TemplateStep({ onPick }: Props) {
  const t = useTranslations("FormsPage.create");
  const tForms = useTranslations("Forms");
  const locale = useLocale() as LibraryLocale;
  const starters = useMemo(() => getStarterForms(locale), [locale]);
  const [filter, setFilter] = useState<Filter>("all");
  const visible = starters.filter(
    (starter) => filter === "all" || starter.category === filter,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("startTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("startDescription")}</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        className={cn(
          CARD_CLASS,
          "justify-start border-dashed border-foreground/25 bg-transparent p-4 shadow-none ring-0 [&>span]:gap-4",
        )}
        onClick={() => onPick(null)}
        data-testid="form-template-blank"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <PlusIcon className="size-5" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="font-medium">{t("blank")}</span>
          <span className="text-sm text-muted-foreground">
            {t("blankDescription")}
          </span>
        </span>
        <ChevronRightIcon
          className="size-4 text-muted-foreground"
          aria-hidden
        />
      </Button>

      <section className="flex flex-col gap-4" aria-labelledby="starters-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="starters-title" className="text-lg font-medium">
            {t("starters")}
          </h2>
          <ToggleGroup
            aria-label={t("filterLabel")}
            value={[filter]}
            onValueChange={(next) => {
              const value = next[0] as Filter | undefined;
              if (value) setFilter(value);
            }}
            className="flex-wrap gap-1.5"
          >
            <ToggleGroupItem
              value="all"
              size="sm"
              className={cn(CHIP_CLASS, "h-8")}
            >
              {t("all")}
            </ToggleGroupItem>
            {FORM_CATEGORY_VALUES.map((category) => (
              <ToggleGroupItem
                key={category}
                value={category}
                size="sm"
                className={cn(CHIP_CLASS, "h-8")}
              >
                {tForms(`categories.${category}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((starter) => {
            const Icon = FORM_CATEGORY_ICONS[starter.category];
            return (
              <li key={starter.key} className="flex">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    CARD_CLASS,
                    "items-stretch p-5 [&>span]:h-full [&>span]:flex-col [&>span]:items-stretch [&>span]:gap-3.5",
                  )}
                  onClick={() => onPick(starter)}
                  data-testid="form-template"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <Badge variant="outline">
                      {tForms(`categories.${starter.category}`)}
                    </Badge>
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{starter.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {starter.description}
                    </span>
                  </span>
                  <Separator className="mt-auto" />
                  <span className="flex w-full items-center gap-1.5">
                    {starter.definition.fields.map((field) => {
                      const FieldIcon = FIELD_TYPE_ICONS[field.type];
                      return (
                        <span
                          key={field.id}
                          className="grid size-6 place-items-center rounded-md bg-muted"
                          title={field.label}
                        >
                          <FieldIcon className="size-3" aria-hidden />
                        </span>
                      );
                    })}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {t("fieldCount", {
                        count: starter.definition.fields.length,
                      })}
                    </span>
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
