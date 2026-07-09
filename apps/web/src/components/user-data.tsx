"use client";

import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

export function UserData() {
  const { user } = useUser();

  return (
    <>
      <Avatar className="size-8 rounded-full">
        <AvatarImage
          src={user?.imageUrl ?? ""}
          alt={user?.fullName ?? ""}
        />
      </Avatar>

      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user?.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {user?.primaryEmailAddress?.emailAddress}
        </span>
      </div>
    </>
  );
}
