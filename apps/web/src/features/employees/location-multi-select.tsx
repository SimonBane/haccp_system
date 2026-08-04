"use client";

import type { LocationResponse } from "@haccp/shared";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTruncatedChips,
  ComboboxTrigger,
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
  maxVisibleChips?: number;
  moreSelectedLabel: (count: number) => string;
  overflowRemoveLabel?: (count: number) => string;
  selectOnly?: boolean;
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
  maxVisibleChips = 3,
  moreSelectedLabel,
  overflowRemoveLabel,
  selectOnly = false,
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

  const handleValueChange = (nextLocations: LocationResponse[]) => {
    onValueChange(nextLocations.map((location) => location.id));
  };

  const showRemove = !selectOnly;

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
        handleValueChange(nextLocations);
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
          selectOnly && "cursor-pointer",
          invalid && "border-destructive ring-destructive/20",
        )}
        aria-invalid={invalid}
      >
        <ComboboxValue>
          {(values: LocationResponse[]) => (
            <ComboboxTruncatedChips
              items={values}
              maxVisible={maxVisibleChips}
              getItemKey={(location) => location.id}
              getItemLabel={(location) => location.name}
              moreLabel={moreSelectedLabel}
              showRemove={showRemove}
              overflowRemoveLabel={overflowRemoveLabel}
              onRemoveOverflow={
                showRemove
                  ? () => handleValueChange(values.slice(0, maxVisibleChips))
                  : undefined
              }
            />
          )}
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          placeholder={placeholder}
          selectOnly={selectOnly}
        />
        {selectOnly ? (
          <ComboboxTrigger
            className="shrink-0 text-muted-foreground"
            disabled={disabled}
          />
        ) : null}
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
