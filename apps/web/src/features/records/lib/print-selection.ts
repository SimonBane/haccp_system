import {
  TARGET_KIND,
  type RecordsExcludedItem,
  type RecordsJournalSummary,
} from "@haccp/shared";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";
import { RECORDS_FILTER_KEY } from "./records-filters";

/**
 * What is left out rather than what is kept, so every journal and item starts ticked
 * however late the list loads, and an item recorded meanwhile is printed too.
 */
export type PrintSelection = {
  /** Unticked items, per journal. */
  excluded: Readonly<Record<string, readonly string[]>>;
  /** Unticked journals that cover the whole location and so have no items to untick. */
  off: readonly string[];
};

export const EMPTY_PRINT_SELECTION: PrintSelection = { excluded: {}, off: [] };

/** What the print screens offer: a piece of equipment, or an area with every component in it. */
export type JournalChoice = {
  key: string;
  name: string;
  kind: typeof TARGET_KIND.EQUIPMENT | typeof TARGET_KIND.AREA;
  targetIds: string[];
  total: number;
};

/** Components never appear on their own: ticking their area brings them all. Area names are unique per location. */
export function journalChoices(
  journal: RecordsJournalSummary,
): JournalChoice[] {
  const choices: JournalChoice[] = [];
  const areas = new Map<string, JournalChoice>();

  for (const target of journal.targets) {
    const areaName =
      target.kind === TARGET_KIND.AREA ? target.name : target.areaName;

    if (target.kind === TARGET_KIND.EQUIPMENT || areaName === null) {
      choices.push({
        key: target.targetId,
        name: target.name,
        kind: TARGET_KIND.EQUIPMENT,
        targetIds: [target.targetId],
        total: target.total,
      });
      continue;
    }

    const area = areas.get(areaName);
    if (area) {
      area.targetIds.push(target.targetId);
      area.total += target.total;
      continue;
    }
    const created: JournalChoice = {
      key: `area:${areaName}`,
      name: areaName,
      kind: TARGET_KIND.AREA,
      targetIds: [target.targetId],
      total: target.total,
    };
    areas.set(areaName, created);
    choices.push(created);
  }

  return choices;
}

export type JournalScope = {
  hasItems: boolean;
  included: boolean;
  choices: JournalChoice[];
  selectedCount: number;
  itemCount: number;
  isChosen: (choice: JournalChoice) => boolean;
  /** Rows the journal prints with the current choice. */
  entries: number;
};

export function journalScope(
  journal: RecordsJournalSummary,
  selection: PrintSelection,
): JournalScope {
  const excluded = new Set(selection.excluded[journal.formId] ?? []);
  const isSelected = (targetId: string) => !excluded.has(targetId);
  const selected = journal.targets.filter((target) =>
    isSelected(target.targetId),
  );
  const choices = journalChoices(journal);
  const isChosen = (choice: JournalChoice) =>
    choice.targetIds.every(isSelected);
  const hasItems = journal.targets.length > 0;
  const included = hasItems
    ? selected.length > 0
    : !selection.off.includes(journal.formId);
  const itemRows = journal.targets.reduce((sum, target) => sum + target.total, 0);
  const entries = included
    ? journal.total -
      itemRows +
      selected.reduce((sum, target) => sum + target.total, 0)
    : 0;

  return {
    hasItems,
    included,
    choices,
    selectedCount: choices.filter(isChosen).length,
    itemCount: choices.length,
    isChosen,
    entries,
  };
}

function withExcluded(
  selection: PrintSelection,
  formId: string,
  targetIds: readonly string[],
): PrintSelection {
  const excluded = { ...selection.excluded };
  if (targetIds.length === 0) delete excluded[formId];
  else excluded[formId] = [...new Set(targetIds)].sort();
  return { ...selection, excluded };
}

/** A journal of items is ticked by ticking them all, and unticked by unticking them all. */
export function toggleJournal(
  selection: PrintSelection,
  journal: RecordsJournalSummary,
): PrintSelection {
  const scope = journalScope(journal, selection);
  if (scope.hasItems) {
    return withExcluded(
      selection,
      journal.formId,
      scope.included ? journal.targets.map((target) => target.targetId) : [],
    );
  }
  const off = scope.included
    ? [...selection.off, journal.formId]
    : selection.off.filter((id) => id !== journal.formId);
  return { ...selection, off };
}

export function setJournalItems(
  selection: PrintSelection,
  journal: RecordsJournalSummary,
  targetIds: readonly string[],
  checked: boolean,
): PrintSelection {
  const current = new Set(selection.excluded[journal.formId] ?? []);
  for (const targetId of targetIds) {
    if (checked) current.delete(targetId);
    else current.add(targetId);
  }
  return withExcluded(selection, journal.formId, [...current]);
}

export function setAllJournals(
  journals: readonly RecordsJournalSummary[],
  checked: boolean,
): PrintSelection {
  if (checked) return EMPTY_PRINT_SELECTION;
  return {
    excluded: Object.fromEntries(
      journals
        .filter((journal) => journal.targets.length > 0)
        .map((journal) => [
          journal.formId,
          journal.targets.map((target) => target.targetId).sort(),
        ]),
    ),
    off: journals
      .filter((journal) => journal.targets.length === 0)
      .map((journal) => journal.formId),
  };
}

export function printSummary(
  journals: readonly RecordsJournalSummary[],
  selection: PrintSelection,
): { journals: number; entries: number; allIncluded: boolean } {
  let count = 0;
  let entries = 0;
  for (const journal of journals) {
    const scope = journalScope(journal, selection);
    if (!scope.included) continue;
    count += 1;
    entries += scope.entries;
  }
  return { journals: count, entries, allIncluded: count === journals.length };
}

/**
 * Every journal ticked keeps the page's own check filter; a subset narrows it. Items are
 * sent as left-out pairs, only for the journals that print, so the link stays short.
 */
export function printScope(input: {
  filters: GridFilterState;
  journals: readonly RecordsJournalSummary[];
  selection: PrintSelection;
}): { filters: GridFilterState; exclude: RecordsExcludedItem[] } {
  const included = input.journals.filter(
    (journal) => journalScope(journal, input.selection).included,
  );
  const filters =
    included.length === input.journals.length
      ? input.filters
      : {
          ...input.filters,
          [RECORDS_FILTER_KEY.FORM]: included.map((journal) => journal.formId),
        };
  const exclude = included.flatMap((journal) =>
    (input.selection.excluded[journal.formId] ?? [])
      .filter((targetId) =>
        journal.targets.some((target) => target.targetId === targetId),
      )
      .map((targetId) => ({ formId: journal.formId, targetId })),
  );
  return { filters, exclude };
}
