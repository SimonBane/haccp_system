"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  findTimezoneOption,
  getTimezoneOptions,
  resolveTimezoneSelection,
  type TimezoneOption,
} from "@/lib/timezones";

type TimezonePickerProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
};

export function TimezonePicker({ id, value, onValueChange }: TimezonePickerProps) {
  const locale = useLocale();
  const t = useTranslations("SettingsPage");
  const options = useMemo(() => getTimezoneOptions(locale), [locale]);

  if (options.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
    );
  }

  return (
    <Combobox
      items={options}
      value={value}
      onValueChange={(nextValue) => {
        if (typeof nextValue === "string" && nextValue) {
          const option = findTimezoneOption(nextValue, locale);
          onValueChange(
            option ? resolveTimezoneSelection(value, option) : nextValue,
          );
          return;
        }

        if (nextValue && typeof nextValue === "object" && "value" in nextValue) {
          onValueChange(
            resolveTimezoneSelection(value, nextValue as TimezoneOption),
          );
        }
      }}
      itemToStringLabel={(item: string | TimezoneOption) => {
        if (typeof item === "string") {
          return findTimezoneOption(item, locale)?.label ?? item;
        }

        return item.label;
      }}
      isItemEqualToValue={(
        item: string | TimezoneOption,
        selectedValue: string | TimezoneOption | null,
      ) => {
        const selectedIana =
          typeof selectedValue === "string"
            ? selectedValue
            : selectedValue?.value;

        if (!selectedIana) {
          return false;
        }

        if (typeof item === "string") {
          const option = findTimezoneOption(item, locale);
          return option?.values.includes(selectedIana) ?? item === selectedIana;
        }

        return item.values.includes(selectedIana);
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={t("timezonePlaceholder")}
        showClear
      />
      <ComboboxContent>
        <ComboboxEmpty>{t("timezoneEmpty")}</ComboboxEmpty>
        <ComboboxList>
          {(item: TimezoneOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
