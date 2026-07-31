"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@clerk/nextjs";
import { ShieldCheckIcon } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
  getAdminNavItems,
  getPlatformNavItems,
} from "@/components/layout/nav-config";
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
    items: item.items,
  }));
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { orgRole } = useAuth();
  const { organization } = useTenant();

  const isAdmin = orgRole === "org:admin";

  const organizationInitials = useMemo(() => {
    const parts = organization.name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return "?";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [organization.name]);

  const navLabels = useMemo(
    () => ({
      today: t("nav.today"),
      organization: t("nav.organization"),
      tasks: t("nav.tasks"),
      equipment: t("nav.equipment"),
      locations: t("nav.locations"),
      employees: t("nav.employees"),
      more: t("nav.more"),
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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="pointer-events-none cursor-default hover:bg-transparent active:bg-transparent"
            >
              <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {organization.hasImage ? (
                  <Avatar className="size-8 rounded-lg after:rounded-lg">
                    <AvatarImage
                      src={organization.imageUrl}
                      alt={organization.name}
                      className="rounded-lg"
                    />
                    <AvatarFallback className="rounded-lg text-xs">
                      {organizationInitials}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <ShieldCheckIcon className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{t("brandName")}</span>
                <span className="truncate text-xs">{organization.name}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
