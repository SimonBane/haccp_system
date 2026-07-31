"use client";

import { UserData } from "@/components/user-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenuDropdownItems } from "@/components/layout/user-menu-items";
import { MoreVerticalIcon } from "lucide-react";

export function NavUser() {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="cursor-pointer aria-expanded:bg-muted data-expanded:bg-sidebar-accent data-expanded:text-sidebar-accent-foreground"
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
        <UserMenuDropdownItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
