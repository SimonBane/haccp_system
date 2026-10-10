"use client";

import {
  getStarterForms,
  type LibraryLocale,
  type StarterForm,
} from "@haccp/shared";
import { ChevronRightIcon, FilePlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { FieldLegend } from "@/components/ui/field";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { FORM_CATEGORY_ICONS } from "../lib/category-icon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (source: StarterForm | null) => void;
};

/** Starter forms are copied into the organisation, in the admin's language, and are theirs to change. */
export function NewFormDialog({ open, onOpenChange, onPick }: Props) {
  const t = useTranslations("FormsPage.library");
  const tForms = useTranslations("Forms");
  const locale = useLocale() as LibraryLocale;
  const starters = useMemo(() => getStarterForms(locale), [locale]);

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      closeLabel={t("close")}
      className="sm:max-w-lg"
    >
      <div className="grid gap-5">
        <Button
          type="button"
          variant="outline"
          className="h-auto justify-start gap-3 px-4 py-3 text-left"
          onClick={() => onPick(null)}
        >
          <FilePlusIcon className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex flex-1 flex-col">
            <span className="font-medium">{t("blank")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("blankDescription")}
            </span>
          </span>
          <ChevronRightIcon className="text-muted-foreground" aria-hidden />
        </Button>

        <div className="grid gap-2">
          <FieldLegend variant="label">{t("starters")}</FieldLegend>
          <ul className="grid gap-2">
            {starters.map((starter) => {
              const Icon = FORM_CATEGORY_ICONS[starter.category];
              return (
                <li key={starter.key}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 px-4 py-3 text-left"
                    onClick={() => onPick(starter)}
                  >
                    <Icon
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {starter.name}
                      </span>
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {tForms(`categories.${starter.category}`)} ·{" "}
                        {t("fieldCount", {
                          count: starter.definition.fields.length,
                        })}
                      </span>
                    </span>
                    <ChevronRightIcon
                      className="text-muted-foreground"
                      aria-hidden
                    />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
