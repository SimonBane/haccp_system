"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
  getAdminNavItems,
  getPlatformNavItems,
} from "@/components/layout/nav-config";
import {
  LocationSwitcherSidebarItem,
  useHasLocationSwitcher,
} from "@/features/tenant/location-picker";
import { useTenant } from "@/features/tenant/tenant-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

function toNavMainItems(
  items: ReturnType<typeof getPlatformNavItems>,
) {
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    icon: <item.icon />,
    isActive: item.isActive,
    defaultExpanded: item.defaultExpanded,
    items: item.items,
  }));
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { orgRole } = useAuth();
  const { organization } = useTenant();
  const hasLocationSwitcher = useHasLocationSwitcher();

  const isAdmin = orgRole === "org:admin";

  const navLabels = useMemo(
    () => ({
      today: t("nav.today"),
      organization: t("nav.organization"),
      tasks: t("nav.tasks"),
      equipment: t("nav.equipment"),
      locations: t("nav.locations"),
      employees: t("nav.employees"),
    }),
    [t],
  );

  const platformNav = useMemo(
    () => toNavMainItems(getPlatformNavItems(pathname, navLabels)),
    [navLabels, pathname],
  );

  const adminNav = useMemo(
    () =>
      toNavMainItems(
        getAdminNavItems(
          pathname,
          navLabels,
          organization.multipleLocationsEnabled,
        ),
      ),
    [navLabels, organization.multipleLocationsEnabled, pathname],
  );

  return (
    <Sidebar variant="inset" aria-label={t("navigation")} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          {hasLocationSwitcher ? (
            <LocationSwitcherSidebarItem />
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="pointer-events-none cursor-default hover:bg-transparent active:bg-transparent"
              >
                <div className="relative size-8 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src="/icons/icon-192x192.png"
                    alt={t("brandName")}
                    width={60}
                    height={60}
                    className="absolute top-1/2 left-1/2 size-[60px] max-w-none -translate-x-1/2 -translate-y-1/2"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{t("brandName")}</span>
                  <span className="truncate text-xs">{organization.name}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={platformNav} groupLabel={t("platform")} />
        {isAdmin ? <NavMain items={adminNav} groupLabel={t("admin")} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
