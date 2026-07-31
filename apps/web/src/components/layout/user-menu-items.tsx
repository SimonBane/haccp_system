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
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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

function SheetMenuButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-11 w-full justify-start", className)}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function UserMenuSheetItems({ onNavigate }: UserMenuItemsProps) {
  const { signOut, openUserProfile } = useClerk();
  const t = useTranslations("Sidebar.userMenu");
  const tLocale = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="px-3 text-xs font-medium text-muted-foreground">
          {t("account")}
        </p>
        <SheetMenuButton
          onClick={() => {
            onNavigate?.();
            openUserProfile();
          }}
        >
          <UserIcon className="size-4" />
          {t("myProfile")}
        </SheetMenuButton>
      </div>

      <div className="space-y-2">
        <p className="px-3 text-xs font-medium text-muted-foreground">
          {tLocale("label")}
        </p>
        <div className="grid grid-cols-2 gap-2 px-1">
          {routing.locales.map((nextLocale) => (
            <Button
              key={nextLocale}
              type="button"
              variant={locale === nextLocale ? "secondary" : "outline"}
              className="h-10"
              onClick={() => {
                if (nextLocale !== locale) {
                  onNavigate?.();
                  setLocaleCookie(nextLocale);
                  router.replace(pathname, { locale: nextLocale });
                }
              }}
            >
              {tLocale(nextLocale)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-3 text-xs font-medium text-muted-foreground">
          {t("theme")}
        </p>
        <div className="grid grid-cols-3 gap-2 px-1">
          {(
            [
              ["light", SunIcon, t("themeLight")],
              ["dark", MoonIcon, t("themeDark")],
              ["system", MonitorIcon, t("themeSystem")],
            ] as const
          ).map(([value, Icon, label]) => (
            <Button
              key={value}
              type="button"
              variant={(theme ?? "system") === value ? "secondary" : "outline"}
              className="h-10 flex-col gap-1 px-1 text-xs"
              onClick={() => {
                onNavigate?.();
                setTheme(value);
              }}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <SheetMenuButton
        className="text-destructive hover:text-destructive"
        onClick={() => {
          onNavigate?.();
          void signOut({ redirectUrl: getClerkLocalePath(locale, "/") });
        }}
      >
        <LogOutIcon className="size-4" />
        {t("logOut")}
      </SheetMenuButton>
    </div>
  );
}
