"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { UserData } from "@/components/user-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePathname, useRouter } from "@/i18n/navigation";
import { setLocaleCookie } from "@/i18n/locale-cookie";
import { routing, type Locale } from "@/i18n/routing";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import {
  UserIcon,
  LanguagesIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  PaletteIcon,
  SunIcon,
} from "lucide-react";

export function NavUser() {
  const { signOut, openUserProfile } = useClerk();
  const { isMobile } = useSidebar();
  const t = useTranslations("Sidebar.userMenu");
  const tLocale = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="aria-expanded:bg-muted data-expanded:bg-sidebar-accent data-expanded:text-sidebar-accent-foreground"
          />
        }
      >
        <UserData />
        <MoreVerticalIcon className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openUserProfile()}>
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
                onValueChange={setTheme}
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
          onClick={() => signOut({ redirectUrl: getClerkLocalePath(locale, "/") })}
        >
          <LogOutIcon />
          {t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
