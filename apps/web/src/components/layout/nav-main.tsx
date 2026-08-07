"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Link } from "@/i18n/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type NavItem = {
  title: string;
  url: string;
  icon: ReactNode;
  isActive?: boolean;
  defaultExpanded?: boolean;
  items?: {
    title: string;
    url: string;
    isActive?: boolean;
  }[];
};

function NavMainItem({ item }: { item: NavItem }) {
  const t = useTranslations("Sidebar");
  const { isMobile, setOpenMobile } = useSidebar();
  const hasActiveChild = item.items?.some((subItem) => subItem.isActive) ?? false;
  const forceOpen = Boolean(item.isActive || hasActiveChild);
  const [open, setOpen] = useState(
    item.defaultExpanded || forceOpen,
  );
  const effectiveOpen = forceOpen || open;

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={item.isActive}
          render={<Link href={item.url} />}
          onClick={closeMobileSidebar}
        >
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      open={effectiveOpen}
      onOpenChange={setOpen}
    >
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={item.isActive}
          render={<Link href={item.url} />}
          onClick={closeMobileSidebar}
        >
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
        <CollapsibleTrigger
          render={<SidebarMenuAction className="aria-expanded:rotate-90" />}
        >
          <ChevronRightIcon />
          <span className="sr-only">{t("toggle")}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  isActive={subItem.isActive}
                  render={<Link href={subItem.url} />}
                  onClick={closeMobileSidebar}
                >
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({
  items,
  groupLabel,
}: {
  items: NavItem[];
  groupLabel: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainItem key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
