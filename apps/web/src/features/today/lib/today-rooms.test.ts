import type {
  FormVersionSummary,
  TargetKind,
  TodayTaskItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildRoundKeys } from "./today-round";
import { buildTimeGroupEntries, entryItems, labelInRoom } from "./today-rooms";
import type { TodayTimeline, TodayTimelineItem } from "./today-timeline";

const KITCHEN = { id: "00000000-0000-4000-8000-0000000000a1", name: "Kitchen 2" };
const BAR = { id: "00000000-0000-4000-8000-0000000000a2", name: "Bar" };

const CLEANING_FORM: FormVersionSummary = {
  id: "00000000-0000-4000-8000-0000000000f1",
  formId: "00000000-0000-4000-8000-0000000000f2",
  formName: "Surface cleaning",
  category: "cleaning",
  version: 1,
  definition: {
    fields: [
      { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
      { id: "notes", type: "text", label: "Notes", required: false, multiline: true },
    ],
    correctiveAction: "required_on_fail",
  },
};

function item(
  key: string,
  targetName: string | null,
  options: {
    kind?: TargetKind;
    area?: { id: string; name: string } | null;
    title?: string;
    completed?: boolean;
  } = {},
): TodayTimelineItem {
  const task = {
    occurrenceId: key,
    title: options.title ?? "Cleaning",
    targetName,
    targetKind: options.kind ?? null,
    area: options.area ?? null,
    status: "pending",
  } as TodayTaskItem;
  return {
    task,
    form: CLEANING_FORM,
    isCompleted: options.completed ?? false,
    isDeviation: false,
    priorRecord: null,
    liveStatus: "pending",
  };
}

const fridge = item("fridge", "Fridge", { kind: "equipment", area: KITCHEN });
const kitchenWalls = item("k-walls", "Kitchen 2 › Walls", { kind: "fixture", area: KITCHEN });
const opening = item("opening", null, { title: "Opening checklist" });
const kitchen = item("kitchen", "Kitchen 2", { kind: "area", area: KITCHEN });
const kitchenFloor = item("k-floor", "Kitchen 2 › Floor", { kind: "fixture", area: KITCHEN });
const barWalls = item("bar-walls", "Bar › Walls", { kind: "fixture", area: BAR });
const items = [fridge, kitchenWalls, opening, kitchen, kitchenFloor, barWalls];

function keys(list: readonly TodayTimelineItem[]) {
  return list.map((entry) => entry.task.occurrenceId);
}

function timelineOf(slot: TodayTimelineItem[]): TodayTimeline {
  return { groups: [{ id: "g", scheduledTime: "22:00", items: slot }] } as TodayTimeline;
}

describe("buildTimeGroupEntries", () => {
  it("folds a room's checks into one card where its first check stood, room then fixtures then equipment", () => {
    const entries = buildTimeGroupEntries(items);

    expect(
      entries.map((entry) =>
        entry.type === "room"
          ? `${entry.name}: ${keys(entry.items).join(",")}`
          : entry.item.task.occurrenceId,
      ),
    ).toEqual(["Kitchen 2: kitchen,k-floor,k-walls,fridge", "opening", "bar-walls"]);
  });

  it("leaves a room with a single check in the slot as a plain row", () => {
    expect(buildTimeGroupEntries([barWalls, opening]).every((entry) => entry.type === "item")).toBe(true);
  });

  it("lists the slot in the order the cards and rows show it", () => {
    expect(keys(entryItems(buildTimeGroupEntries(items)))).toEqual([
      "kitchen",
      "k-floor",
      "k-walls",
      "fridge",
      "opening",
      "bar-walls",
    ]);
  });
});

describe("labelInRoom", () => {
  it("drops the room prefix a fixture's label repeats", () => {
    expect(labelInRoom(kitchenWalls.task)).toBe("Walls");
    expect(labelInRoom(fridge.task)).toBe("Fridge");
    expect(labelInRoom(opening.task)).toBeNull();
  });

  it("keeps a label whose room was renamed after it was recorded", () => {
    const renamed = item("old", "Old kitchen › Walls", { kind: "fixture", area: KITCHEN });
    expect(labelInRoom(renamed.task)).toBe("Old kitchen › Walls");
  });
});

describe("buildRoundKeys with room cards", () => {
  const timeline = timelineOf(items);

  it("walks the rest of the tapped check's room, and stops there", () => {
    expect(buildRoundKeys(timeline, kitchenFloor)).toEqual(["k-floor", "k-walls", "fridge"]);
  });

  it("walks the whole slot in display order for the slot's Record all", () => {
    expect(buildRoundKeys(timeline, kitchen, "slot")).toEqual([
      "kitchen",
      "k-floor",
      "k-walls",
      "fridge",
      "opening",
      "bar-walls",
    ]);
  });

  it("skips checks already done", () => {
    const done = item("k-floor", "Kitchen 2 › Floor", {
      kind: "fixture",
      area: KITCHEN,
      completed: true,
    });
    const slot = timelineOf([kitchen, done, kitchenWalls, fridge]);
    expect(buildRoundKeys(slot, kitchen)).toEqual(["kitchen", "k-walls", "fridge"]);
  });
});
