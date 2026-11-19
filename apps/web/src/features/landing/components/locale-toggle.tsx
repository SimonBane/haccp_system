"use client";

import { useLocale, useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { useRouter } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";

export function LocaleToggle() {
  const t = useTranslations("LocaleSwitcher");
  const router = useRouter();
  const locale = useLocale() as Locale;

  return (
    <ToggleGroup
      aria-label={t("label")}
      value={[locale]}
      onValueChange={(values) => {
        const next = values.find((value) => value !== locale) as
          | Locale
          | undefined;
        if (!next) return;
        setLocaleCookie(next);
        router.replace("/", { locale: next });
      }}
      spacing={1}
      className="rounded-full border p-0.5"
    >
      {routing.locales.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          lang={option}
          aria-label={t(option)}
          className="h-7 min-w-10 cursor-pointer rounded-full px-3 text-xs font-semibold text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
        >
          {option.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
