"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  LanguagesIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { routing, type Locale } from "@/i18n/routing";
import { getClerkLocalePath } from "@/lib/clerk-localization";

type UserMenuItemsProps = {
  onNavigate?: () => void;
};

export function UserMenuDropdownItems({ onNavigate }: UserMenuItemsProps) {
  const { signOut, openUserProfile } = useClerk();
  const t = useTranslations("Sidebar.userMenu");
  const tLocale = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            onNavigate?.();
            openUserProfile();
          }}
        >
          <UserIcon />
          {t("myProfile")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("preferences")}</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LanguagesIcon />
            {tLocale("label")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(value) => {
                if (value !== locale) {
                  onNavigate?.();
                  setLocaleCookie(value as Locale);
                  router.replace(pathname, { locale: value as Locale });
                }
              }}
            >
              {routing.locales.map((nextLocale) => (
                <DropdownMenuRadioItem key={nextLocale} value={nextLocale}>
                  {tLocale(nextLocale)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <PaletteIcon />
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => {
                onNavigate?.();
                setTheme(value);
              }}
            >
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                {t("themeLight")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                {t("themeDark")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon />
                {t("themeSystem")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => {
          onNavigate?.();
          void signOut({ redirectUrl: getClerkLocalePath(locale, "/") });
        }}
      >
        <LogOutIcon />
        {t("logOut")}
      </DropdownMenuItem>
    </>
  );
}
