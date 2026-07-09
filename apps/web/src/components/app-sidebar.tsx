"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  BookOpenIcon,
  BotIcon,
  FrameIcon,
  MapIcon,
  PieChartIcon,
  Settings2Icon,
  ShieldCheckIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { Link } from "@/i18n/navigation";
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

  const navMain = [
    {
      title: t("navMain.playground"),
      url: "#",
      icon: <TerminalSquareIcon />,
      isActive: true,
      items: [
        { title: t("navMain.history"), url: "#" },
        { title: t("navMain.starred"), url: "#" },
        { title: t("navMain.settings"), url: "#" },
      ],
    },
    {
      title: t("navMain.models"),
      url: "#",
      icon: <BotIcon />,
      items: [
        { title: t("navMain.genesis"), url: "#" },
        { title: t("navMain.explorer"), url: "#" },
        { title: t("navMain.quantum"), url: "#" },
      ],
    },
    {
      title: t("navMain.documentation"),
      url: "#",
      icon: <BookOpenIcon />,
      items: [
        { title: t("navMain.introduction"), url: "#" },
        { title: t("navMain.getStarted"), url: "#" },
        { title: t("navMain.tutorials"), url: "#" },
        { title: t("navMain.changelog"), url: "#" },
      ],
    },
    {
      title: t("navMain.settings"),
      url: "#",
      icon: <Settings2Icon />,
      items: [
        { title: t("navMain.general"), url: "#" },
        { title: t("navMain.team"), url: "#" },
        { title: t("navMain.billing"), url: "#" },
        { title: t("navMain.limits"), url: "#" },
      ],
    },
  ];

  const projects = [
    {
      name: t("projects.designEngineering"),
      url: "#",
      icon: <FrameIcon />,
    },
    {
      name: t("projects.salesMarketing"),
      url: "#",
      icon: <PieChartIcon />,
    },
    {
      name: t("projects.travel"),
      url: "#",
      icon: <MapIcon />,
    },
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
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
        <NavMain items={navMain} groupLabel={t("platform")} />
        <NavProjects projects={projects} groupLabel={t("projectsLabel")} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
