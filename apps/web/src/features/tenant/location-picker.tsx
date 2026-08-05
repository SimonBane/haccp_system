"use client";

import type { LocationResponse } from "@haccp/shared";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronsUpDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useTenant } from "@/features/tenant/tenant-provider";

/** Default site first — it is the one most people want — then alphabetical. */
function orderLocations(locations: LocationResponse[]): LocationResponse[] {
  return [...locations].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function useHasLocationSwitcher(): boolean {
  const { organization, locations } = useTenant();
  return organization.multipleLocationsEnabled && locations.length > 1;
}

/**
 * Sidebar identity block. When more than one location exists this replaces the
 * static brand row entirely rather than stacking under it — org and location
 * are the context everything below is scoped to, and two stacked identity
 * blocks read as duplication.
 */
export function LocationSwitcherSidebarItem() {
  const t = useTranslations("LocationPicker");
  const tSidebar = useTranslations("Sidebar");
  const { organization, locations, locationId, selectedLocation, setLocationId } =
    useTenant();

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              aria-label={t("label")}
              className="data-popup-open:bg-sidebar-accent"
            />
          }
        >
          <div className="relative size-8 shrink-0 overflow-hidden rounded-lg">
            <Image
              src="/icons/icon-192x192.png"
              alt={tSidebar("brandName")}
              width={60}
              height={60}
              className="absolute top-1/2 left-1/2 size-[60px] max-w-none -translate-x-1/2 -translate-y-1/2"
            />
          </div>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold">
              {selectedLocation.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {organization.name}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={locationId}
              onValueChange={(value) => {
                if (value) setLocationId(value);
              }}
            >
              {orderLocations(locations).map((location) => (
                <DropdownMenuRadioItem key={location.id} value={location.id}>
                  {location.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}