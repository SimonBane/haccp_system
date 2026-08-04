"use client";

import type { LocationResponse } from "@haccp/shared";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type LocationMultiSelectProps = {
  id?: string;
  locations: LocationResponse[];
  value: string[];
  onValueChange: (value: string[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  noLocationsMessage?: string;
};

export function LocationMultiSelect({
  id,
  locations,
  value,
  onValueChange,
  disabled = false,
  invalid = false,
  placeholder,
  emptyMessage,
  noLocationsMessage,
}: LocationMultiSelectProps) {
  const anchor = useComboboxAnchor();

  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );

  const selectedLocations = useMemo(
    () =>
      value
        .map((locationId) => locationById.get(locationId))
        .filter((location): location is LocationResponse => location !== undefined),
    [locationById, value],
  );

  if (locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {noLocationsMessage}
      </p>
    );
  }

  return (
    <Combobox
      items={locations}
      multiple
      disabled={disabled}
      value={selectedLocations}
      onValueChange={(nextValue) => {
        const nextLocations = Array.isArray(nextValue) ? nextValue : [];
        onValueChange(nextLocations.map((location) => location.id));
      }}
      itemToStringLabel={(item) => item.name}
      isItemEqualToValue={(item, selectedValue) =>
        item.id === selectedValue?.id
      }
    >
      <ComboboxChips
        ref={anchor}
        className={cn(
          "w-full",
          invalid && "border-destructive ring-destructive/20",
        )}
        aria-invalid={invalid}
      >
        <ComboboxValue>
          {(values: LocationResponse[]) => (
            <>
              {values.map((location) => (
                <ComboboxChip key={location.id}>{location.name}</ComboboxChip>
              ))}
            </>
          )}
        </ComboboxValue>
        <ComboboxChipsInput id={id} placeholder={placeholder} />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(location: LocationResponse) => (
            <ComboboxItem key={location.id} value={location}>
              {location.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
