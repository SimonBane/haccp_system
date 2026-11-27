import type { RecordsJournalSummary } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  EMPTY_PRINT_SELECTION,
  journalChoices,
  journalScope,
  printScope,
  printSummary,
  setAllJournals,
  setJournalItems,
  toggleJournal,
} from "./print-selection";

const FRIDGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLEANING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OPENING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const WALLS = "33333333-3333-4333-8333-333333333333";
const FLOOR = "44444444-4444-4444-8444-444444444444";

const JOURNALS: RecordsJournalSummary[] = [
  {
    formId: FRIDGE,
    name: "Fridge temperature",
    total: 30,
    targets: [
      { targetId: T1, name: "Walk-in fridge", kind: "equipment", areaName: null, total: 20 },
      { targetId: T2, name: "Display counter", kind: "equipment", areaName: null, total: 10 },
    ],
  },
  {
    formId: CLEANING,
    name: "Cleaning",
    total: 12,
    targets: [
      { targetId: WALLS, name: "Walls", kind: "component", areaName: "Cutting room", total: 6 },
      { targetId: FLOOR, name: "Floor", kind: "component", areaName: "Cutting room", total: 6 },
    ],
  },
  { formId: OPENING, name: "Opening checklist", total: 26, targets: [] },
];
const [fridge, cleaning, opening] = JOURNALS as [
  RecordsJournalSummary,
  RecordsJournalSummary,
  RecordsJournalSummary,
];

describe("print selection", () => {
  it("starts with every journal and item ticked", () => {
    expect(printSummary(JOURNALS, EMPTY_PRINT_SELECTION)).toEqual({
      journals: 3,
      entries: 68,
      allIncluded: true,
    });
  });

  it("counts only the ticked items of a journal", () => {
    const selection = setJournalItems(EMPTY_PRINT_SELECTION, fridge, [T2], false);
    const scope = journalScope(fridge, selection);
    expect([scope.included, scope.selectedCount, scope.itemCount, scope.entries]).toEqual([true, 1, 2, 20]);
  });

  it("drops a journal once every item is unticked, and ticks them all again", () => {
    const off = toggleJournal(EMPTY_PRINT_SELECTION, fridge);
    expect(journalScope(fridge, off).included).toBe(false);
    expect(journalScope(fridge, toggleJournal(off, fridge)).selectedCount).toBe(2);
  });

  it("toggles a whole-location journal on its own", () => {
    const off = toggleJournal(EMPTY_PRINT_SELECTION, opening);
    expect(journalScope(opening, off).included).toBe(false);
    expect(journalScope(opening, toggleJournal(off, opening)).included).toBe(true);
  });

  it("clears and selects every journal at once", () => {
    expect(printSummary(JOURNALS, setAllJournals(JOURNALS, false)).journals).toBe(0);
    expect(setAllJournals(JOURNALS, true)).toEqual(EMPTY_PRINT_SELECTION);
  });
});

describe("print scope", () => {
  it("keeps the page's filters when everything prints", () => {
    expect(printScope({ filters: { target: [T1] }, journals: JOURNALS, selection: EMPTY_PRINT_SELECTION })).toEqual({
      filters: { target: [T1] },
      exclude: [],
    });
  });

  it("narrows to the ticked journals and leaves out unticked items as pairs", () => {
    let selection = toggleJournal(EMPTY_PRINT_SELECTION, opening);
    selection = setJournalItems(selection, fridge, [T2], false);
    expect(printScope({ filters: {}, journals: JOURNALS, selection })).toEqual({
      filters: { form: [FRIDGE, CLEANING] },
      exclude: [{ formId: FRIDGE, targetId: T2 }],
    });
  });

  it("sends no pairs for a journal that is not printed at all", () => {
    const selection = toggleJournal(EMPTY_PRINT_SELECTION, cleaning);
    expect(printScope({ filters: {}, journals: JOURNALS, selection }).exclude).toEqual([]);
  });
});

describe("journal choices", () => {
  const AREA = "55555555-5555-4555-8555-555555555555";
  const withArea: RecordsJournalSummary = {
    ...cleaning,
    total: 17,
    targets: [
      { targetId: AREA, name: "Cutting room", kind: "area", areaName: null, total: 3 },
      ...cleaning.targets,
      { targetId: T1, name: "Mincer", kind: "equipment", areaName: null, total: 2 },
    ],
  };

  it("offers equipment and areas only, an area carrying its components", () => {
    expect(
      journalChoices(withArea).map((choice) => [choice.kind, choice.name, choice.targetIds, choice.total]),
    ).toEqual([
      ["area", "Cutting room", [AREA, WALLS, FLOOR], 15],
      ["equipment", "Mincer", [T1], 2],
    ]);
  });

  it("forms an area from its components even when the area has no rows of its own", () => {
    expect(journalChoices(cleaning).map((choice) => [choice.kind, choice.targetIds])).toEqual([
      ["area", [WALLS, FLOOR]],
    ]);
  });

  it("counts and ticks choices, not single components", () => {
    const [area] = journalChoices(withArea);
    const off = setJournalItems(EMPTY_PRINT_SELECTION, withArea, area!.targetIds, false);
    const scope = journalScope(withArea, off);
    expect([scope.itemCount, scope.selectedCount, scope.isChosen(area!), scope.entries]).toEqual([2, 1, false, 2]);
  });
});
