"use client";

import type { Table } from "@tanstack/react-table";
import { useRef, useState } from "react";
import { ShellOverlay } from "@/components/layout/shell-slots";
import { SearchInput } from "@/components/ui/search-input";

type DataTableMobileSearchProps<TData> = {
  table: Table<TData>;
  column: string;
  placeholder: string;
};

const DEBOUNCE_MS = 350;

/**
 * The list's search, floating over the bottom of the content.
 *
 * Down here rather than above the list because that is where the thumb is, and
 * because a field at the top of a scroll region scrolls away exactly when you
 * start needing it. Moving it also empties the toolbar row on mobile entirely,
 * so the list now starts flush at the top of the screen.
 *
 * Portalled through `ShellOverlay`, not `position: fixed`: on mobile the content
 * panel always carries a `translate` for the nav drawer, which makes it a
 * containing block, so a fixed box would slide out with the drawer.
 */
export function DataTableMobileSearch<TData>({
  table,
  column,
  placeholder,
}: DataTableMobileSearchProps<TData>) {
  const externalValue =
    (table.getColumn(column)?.getFilterValue() as string) ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? externalValue;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handleSearch = (next: string) => {
    setDraft(next);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Clearing is immediate: waiting 350ms to get the full list back reads as
    // the app having hung.
    if (next === "") {
      table.getColumn(column)?.setFilterValue("");
      setDraft(null);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      table.getColumn(column)?.setFilterValue(next);
      setDraft(null);
      timeoutRef.current = undefined;
    }, DEBOUNCE_MS);
  };

  return (
    <ShellOverlay>
      <div
        // The overlay resolves against the inset's padding box, which already
        // carries the bottom safe-area inset — adding env() here would lift it
        // by the home indicator twice. --keyboard-gap is the same value for the
        // keyboard, measured from inside that padding.
        className="pointer-events-auto absolute inset-x-0 bottom-0 px-4 pb-[calc(1.25rem+var(--keyboard-gap,0px))]"
        // A horizontal drag inside a text field is text selection, not a
        // request to open the nav drawer.
        data-no-swipe=""
      >
        <SearchInput
          placeholder={placeholder}
          value={value}
          onSearch={handleSearch}
          enterKeyHint="search"
          className="h-(--control-h) w-full rounded-full bg-popover shadow-lg ring-1 ring-border"
        />
      </div>
    </ShellOverlay>
  );
}
