"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  CalendarDaysIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  ThermometerSnowflakeIcon,
} from "lucide-react";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { orgRole } = useAuth();

  const isAdmin = orgRole === "org:admin";

  const platformNav = [
    {
      title: t("nav.today"),
      url: "/dashboard",
      icon: <CalendarDaysIcon />,
      isActive: pathname === "/dashboard",
    },
  ];

  const adminNav = [
    {
      title: t("nav.tasks"),
      url: "/dashboard/task-templates",
      icon: <ListChecksIcon />,
      isActive: pathname.startsWith("/dashboard/task-templates"),
    },
    {
      title: t("nav.equipment"),
      url: "/dashboard/equipment",
      icon: <ThermometerSnowflakeIcon />,
      isActive: pathname.startsWith("/dashboard/equipment"),
    },
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="pointer-events-none cursor-default hover:bg-transparent active:bg-transparent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldCheckIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{t("brandName")}</span>
                <span className="truncate text-xs">{t("brandPlan")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={platformNav} groupLabel={t("platform")} />
        {isAdmin ? <NavMain items={adminNav} groupLabel={t("nav.settings")} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
