"use client";

import { useTranslations } from "next-intl";
import { MapPinIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/features/tenant/tenant-provider";

export function LocationPickerSlot() {
  const { organization } = useTenant();

  if (!organization.multipleLocationsEnabled) {
    return null;
  }

  return <LocationPicker />;
}

export function LocationPicker() {
  const t = useTranslations("LocationPicker");
  const { locations, locationId, currentLocation, setCurrentLocation } =
    useTenant();

  if (locations.length <= 1) {
    return null;
  }

  return (
    <div className="mr-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm hover:bg-accent/50 aria-expanded:bg-accent data-expanded:bg-accent"
            />
          }
        >
          <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-[220px] truncate font-medium">
            {currentLocation.name}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={locationId}
              onValueChange={(value) => {
                if (value) {
                  setCurrentLocation(value);
                }
              }}
            >
              {locations.map((location) => (
                <DropdownMenuRadioItem key={location.id} value={location.id}>
                  {location.name}
                  {location.isDefault ? ` (${t("default")})` : ""}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
