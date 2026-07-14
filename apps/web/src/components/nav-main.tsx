"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
} from "@/components/ui/sidebar";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type NavItem = {
  title: string;
  url: string;
  icon: ReactNode;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
};

function NavMainItem({ item }: { item: NavItem }) {
  const t = useTranslations("Sidebar");
  const [open, setOpen] = useState(item.isActive ?? false);

  useEffect(() => {
    if (item.isActive) {
      setOpen(true);
    }
  }, [item.isActive]);

  if (!item.items?.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={item.isActive}
          render={<Link href={item.url} />}
        >
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
    >
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={item.isActive}
          render={<Link href={item.url} />}
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
                <SidebarMenuSubButton render={<Link href={subItem.url} />}>
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
