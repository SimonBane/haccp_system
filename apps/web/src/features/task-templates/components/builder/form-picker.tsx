"use client";

import {
  FORM_CATEGORY_VALUES,
  getMeasurementFields,
  type FormCategory,
  type FormListItem,
} from "@haccp/shared";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NEW_FORM_PATH = "/dashboard/forms/new";

type FormPickerProps = {
  id: string;
  labelId: string;
  forms: FormListItem[];
  value: string | null;
  onChange: (form: FormListItem) => void;
  invalid: boolean;
};

type FormGroup = { value: string; items: FormListItem[] };

/** "Equipment · 0 to 4 °C" or "Areas · 6 questions": what a form checks, readable before picking it. */
function useFormMeta() {
  const t = useTranslations("TasksPage.builder.form");
  const tForms = useTranslations("Forms");
  const format = useAnswerFormat();

  return (form: FormListItem) => {
    const [measurement] = getMeasurementFields(form.latestVersion.definition);
    const detail = measurement ? format.limits(measurement.limits, measurement.unit) : null;
    return [
      tForms(`appliesTo.${form.appliesTo}`),
      detail ?? t("questions", { count: form.latestVersion.definition.fields.length }),
    ].join(" · ");
  };
}

function useFormGroups(forms: FormListItem[]): FormGroup[] {
  const tForms = useTranslations("Forms");
  return FORM_CATEGORY_VALUES.map((category: FormCategory) => ({
    value: tForms(`categories.${category}`),
    items: forms
      .filter((form) => form.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.items.length > 0);
}

function FormTile({ form, active, size }: { form: FormListItem | null; active: boolean; size: "sm" | "md" | "lg" }) {
  const Icon = form ? FORM_CATEGORY_ICONS[form.category] : null;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" && "size-7 rounded-md",
        size === "md" && "size-8 rounded-lg",
        size === "lg" && "size-10 rounded-[10px]",
        active ? "bg-primary/15 text-primary" : "bg-muted",
      )}
    >
      {Icon ? <Icon className={size === "sm" ? "size-3.5" : "size-4"} /> : null}
    </span>
  );
}

/** Desktop: one field that opens a searchable list grouped by category, so it stays one row however many forms exist. */
export function FormPicker({ id, labelId, forms, value, onChange, invalid }: FormPickerProps) {
  const t = useTranslations("TasksPage.builder.form");
  const meta = useFormMeta();
  const groups = useFormGroups(forms);
  const selected = forms.find((form) => form.id === value) ?? null;

  return (
    <Combobox
      items={groups}
      value={selected}
      onValueChange={(next) => {
        if (next) onChange(next as FormListItem);
      }}
      itemToStringLabel={(form: FormListItem) => form.name}
      isItemEqualToValue={(form: FormListItem, other: FormListItem | null) =>
        form.id === other?.id
      }
    >
      <ComboboxTrigger
        id={id}
        aria-labelledby={labelId}
        aria-invalid={invalid}
        className="flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-primary/20"
      >
        <FormTile form={selected} active size="md" />
        {selected ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="truncate text-xs text-muted-foreground">{meta(selected)}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">{t("choose")}</span>
        )}
      </ComboboxTrigger>
      <ComboboxContent className="p-0">
        <div className="border-b p-2">
          <ComboboxInput
            showTrigger={false}
            className="w-full"
            placeholder={t("search", { count: forms.length })}
            aria-label={t("searchLabel")}
          />
        </div>
        <ComboboxEmpty className="py-5">{t("noMatch")}</ComboboxEmpty>
        <ComboboxList className="max-h-[min(26rem,calc(var(--available-height)-7rem))]">
          {(group: FormGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel className="font-semibold">{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(form: FormListItem) => (
                  <ComboboxItem key={form.id} value={form} className="gap-2.5 md:min-h-10">
                    <FormTile form={form} active={false} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-medium">{form.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{meta(form)}</span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            className="w-full justify-start text-primary"
            nativeButton={false}
            render={<Link href={NEW_FORM_PATH} />}
          >
            <PlusIcon data-icon="inline-start" />
            {t("createNew")}
          </Button>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}

/** Mobile: the chosen form as one row; tapping it opens a full-height sheet with search and a roomy list. */
export function MobileFormPicker({ id, labelId, forms, value, onChange, invalid }: FormPickerProps) {
  const t = useTranslations("TasksPage.builder.form");
  const meta = useFormMeta();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = forms.find((form) => form.id === value) ?? null;
  const search = query.trim().toLowerCase();
  const groups = useFormGroups(
    forms.filter(
      (form) =>
        !search ||
        form.name.toLowerCase().includes(search) ||
        meta(form).toLowerCase().includes(search),
    ),
  );

  function close(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={labelId}
        data-invalid={invalid}
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[invalid=true]:border-destructive"
      >
        <FormTile form={selected} active size="md" />
        {selected ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{selected.name}</span>
            <span className="truncate text-xs text-muted-foreground">{meta(selected)}</span>
          </span>
        ) : (
          <span className="flex-1 text-muted-foreground">{t("choose")}</span>
        )}
        {selected ? (
          <span className="text-[13px] font-medium text-primary">{t("change")}</span>
        ) : (
          <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>

      <ResponsiveFormSheet open={open} onOpenChange={close} title={t("sheetTitle")} closeLabel={t("close")}>
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            placeholder={t("search", { count: forms.length })}
            aria-label={t("searchLabel")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div role="listbox" aria-label={t("sheetTitle")} className="flex flex-col gap-1">
            {groups.map((group) => (
              <div key={group.value} role="group" aria-label={group.value} className="flex flex-col gap-0.5">
                <span className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground">
                  {group.value}
                </span>
                {group.items.map((form) => {
                  const active = form.id === value;
                  return (
                    <button
                      key={form.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(form);
                        close(false);
                      }}
                      className={cn(
                        "flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-xl border p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active ? "border-primary/35 bg-primary/[0.07]" : "border-transparent",
                      )}
                    >
                      <FormTile form={form} active={active} size="lg" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate text-[15px] leading-5", active ? "font-semibold" : "font-medium")}>
                          {form.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{meta(form)}</span>
                      </span>
                      {active ? <CheckIcon className="size-5 text-primary" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
            ) : null}
            <Button
              variant="ghost"
              className="h-12 justify-start text-primary"
              nativeButton={false}
            render={<Link href={NEW_FORM_PATH} />}
            >
              <PlusIcon data-icon="inline-start" />
              {t("createNew")}
            </Button>
          </div>
        </div>
      </ResponsiveFormSheet>
    </>
  );
}
