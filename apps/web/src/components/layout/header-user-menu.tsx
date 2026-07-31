"use client";

import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenuDropdownItems } from "@/components/layout/user-menu-items";

export function HeaderUserMenu() {
  const { user } = useUser();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label={user?.fullName ?? "Account"}
          />
        }
      >
        <Avatar className="size-9">
          <AvatarImage
            src={user?.imageUrl ?? ""}
            alt={user?.fullName ?? ""}
          />
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
        <UserMenuDropdownItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
