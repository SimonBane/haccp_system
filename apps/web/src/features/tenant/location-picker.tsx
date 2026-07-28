"use client";

import { useTranslations } from "next-intl";
import { MapPinIcon } from "lucide-react";
import { useTenant } from "@/features/tenant/tenant-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LocationPickerSlot() {
  const { organization } = useTenant();

  if (!organization.multipleLocationsEnabled) {
    return null;
  }

  return <LocationPicker />;
}

export function LocationPicker() {
  const t = useTranslations("LocationPicker");
  const { locations, locationId, setCurrentLocation } = useTenant();

  if (locations.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4">
      <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
      <Select
        value={locationId}
        onValueChange={(value) => {
          if (value) {
            setCurrentLocation(value);
          }
        }}
      >
        <SelectTrigger className="w-full max-w-[220px]">
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
              {location.isDefault ? ` (${t("default")})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
