import type {
  FormDefinition,
  FormVersionSummary,
  FormVersionSummaryMap,
  RecordItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import {
  JOURNAL_SHAPE,
  journalShape,
  toDailyChecklist,
  toJournalDocuments,
  toReadingsGrid,
  type JournalDocumentContext,
} from "./journal-document";

let nextId = 0;
function id(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
}

const FRIDGE_FORM = id();
const FRIDGE_V1 = id();
const FRIDGE_V2 = id();
const CLEANING_FORM = id();
const CLEANING_V1 = id();
const COOKING_FORM = id();
const COOKING_V1 = id();
const BORIS = { id: id(), firstName: "Борис", lastName: "Оператор" };
const VERA = { id: id(), firstName: "Вера", lastName: "Технолог" };

const TEMPERATURE: FormDefinition["fields"][number] = {
  id: "temperature",
  type: "measurement",
  label: "Температура",
  required: true,
  parameter: "temperature",
  unit: "celsius",
  limits: { min: 0, max: 7 },
};

function version(
  overrides: Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">,
): FormVersionSummary {
  return {
    formId: FRIDGE_FORM,
    formName: "Хладилни камери",
    category: "temperature",
    appliesTo: "per_item",
    onDemand: false,
    version: 1,
    publishedAt: "2026-10-01T08:00:00.000Z",
    definition: { correctiveAction: "required_on_fail", fields: [TEMPERATURE] },
    ...overrides,
  };
}

const FORM_VERSIONS: FormVersionSummaryMap = {
  [FRIDGE_V1]: version({ id: FRIDGE_V1 }),
  [FRIDGE_V2]: version({
    id: FRIDGE_V2,
    version: 2,
    publishedAt: "2026-11-10T08:00:00.000Z",
  }),
  [CLEANING_V1]: version({
    id: CLEANING_V1,
    formId: CLEANING_FORM,
    formName: "Почистване и дезинфекция",
    category: "cleaning",
    definition: {
      correctiveAction: "optional",
      fields: [
        {
          id: "before",
          type: "checkbox",
          label: "Преди работа",
          required: true,
        },
        { id: "after", type: "checkbox", label: "След работа", required: true },
      ],
    },
  }),
  [COOKING_V1]: version({
    id: COOKING_V1,
    formId: COOKING_FORM,
    formName: "Варене",
    onDemand: true,
    appliesTo: "location",
  }),
};

const CONTEXT: JournalDocumentContext = {
  formVersions: FORM_VERSIONS,
  format: buildAnswerFormatters({
    locale: "bg",
    symbol: (unit) => (unit === "celsius" ? "°C" : unit),
    yes: "Да",
    no: "Не",
  }),
  limits: (limits) => `${limits.min} до ${limits.max}`,
};

const CHAMBER_1 = id();
const CHAMBER_2 = id();

function item(overrides: Partial<RecordItem> = {}): RecordItem {
  const rowId = id();
  return {
    id: rowId,
    kind: "scheduled",
    occurrenceId: rowId,
    taskTemplateId: id(),
    entryDate: "2026-11-02",
    entryTime: "08:00",
    availableAt: "2026-11-02T06:00:00.000Z",
    dueAt: null,
    title: "Хладилни камери",
    formVersionId: FRIDGE_V2,
    category: "temperature",
    targetId: CHAMBER_1,
    targetName: "Камера 1",
    resolvedLimits: { temperature: { min: 0, max: 7 } },
    displayState: "missed",
    recordState: "none",
    timing: "not_submitted",
    result: "not_evaluated",
    record: null,
    ...overrides,
  } as RecordItem;
}

function reading(
  value: number,
  overrides: Partial<RecordItem> = {},
  options: { fails?: boolean; by?: typeof BORIS; action?: string } = {},
): RecordItem {
  return item({
    displayState: "submitted",
    recordState: "submitted",
    timing: "on_time",
    result: options.fails ? "fail" : "pass",
    record: {
      recordId: id(),
      createdAt: "2026-11-02T06:05:00.000Z",
      createdBy: options.by ?? BORIS,
      recordedAt: "2026-11-02T06:05:00.000Z",
      recordedBy: options.by ?? BORIS,
      voidedAt: null,
      voidedBy: null,
      values: {
        temperature: {
          type: "measurement",
          value,
          unit: "celsius",
          min: 0,
          max: 7,
          fails: options.fails ?? false,
        },
      },
      correctiveAction: options.action ?? null,
    } as RecordItem["record"],
    ...overrides,
  });
}

function cleaned(targetName: string, overrides: Partial<RecordItem> = {}) {
  return item({
    formVersionId: CLEANING_V1,
    title: "Почистване и дезинфекция",
    category: "cleaning",
    targetId: id(),
    targetName,
    resolvedLimits: {},
    displayState: "submitted",
    recordState: "submitted",
    timing: "on_time",
    result: "pass",
    record: {
      recordId: id(),
      createdAt: "2026-11-02T06:05:00.000Z",
      createdBy: BORIS,
      recordedAt: "2026-11-02T06:05:00.000Z",
      recordedBy: BORIS,
      voidedAt: null,
      voidedBy: null,
      values: {
        before: { type: "checkbox", value: true },
        after: { type: "checkbox", value: true },
      },
      correctiveAction: null,
    } as RecordItem["record"],
    ...overrides,
  });
}

const FRIDGE = [FORM_VERSIONS[FRIDGE_V2]!];
const CLEANING = [FORM_VERSIONS[CLEANING_V1]!];

describe("journalShape", () => {
  it("logs on-demand checks entry by entry", () => {
    expect(journalShape([FORM_VERSIONS[COOKING_V1]!], [item()])).toBe(
      JOURNAL_SHAPE.LOG,
    );
  });

  it("prints a per-item checklist with no measurement as a daily checklist", () => {
    const items = [cleaned("Цех › Под"), cleaned("Цех › Стени")];

    expect(journalShape(CLEANING, items)).toBe(JOURNAL_SHAPE.CHECKLIST);
  });

  it("logs a checklist kept for a single item one row per check", () => {
    expect(journalShape(CLEANING, [cleaned("Стерилизатор")])).toBe(
      JOURNAL_SHAPE.LOG,
    );
  });

  it("prints a single reading as a grid of days by check time", () => {
    const items = ["08:00", "14:00", "20:00"].map((entryTime) =>
      reading(3, { entryTime }),
    );

    expect(journalShape(FRIDGE, items)).toBe(JOURNAL_SHAPE.GRID);
  });

  it("logs a check with several fields one row per check", () => {
    const humidity = version({
      id: id(),
      definition: {
        correctiveAction: "required_on_fail",
        fields: [
          TEMPERATURE,
          {
            id: "humidity",
            type: "measurement",
            label: "Влажност",
            required: true,
            parameter: "humidity",
            unit: "percent",
            limits: { min: 75, max: 90 },
          },
        ],
      },
    } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">);

    expect(journalShape([humidity], [reading(3)])).toBe(JOURNAL_SHAPE.LOG);
  });

  it("logs a reading taken at more check times than a grid holds", () => {
    const times = Array.from(
      { length: 9 },
      (_, hour) => `${String(hour + 8).padStart(2, "0")}:00`,
    );
    const items = times.map((entryTime) => reading(3, { entryTime }));

    expect(journalShape(FRIDGE, items)).toBe(JOURNAL_SHAPE.LOG);
  });

  it("logs a multiline answer", () => {
    const notes = version({
      id: id(),
      definition: {
        correctiveAction: "optional",
        fields: [
          {
            id: "notes",
            type: "text",
            label: "Бележки",
            required: false,
            multiline: true,
          },
        ],
      },
    });

    expect(journalShape([notes], [item()])).toBe(JOURNAL_SHAPE.LOG);
  });
});

describe("toReadingsGrid", () => {
  it("lays days out as rows and check times as columns, one block per item", () => {
    const grid = toReadingsGrid(
      [
        reading(4, { entryDate: "2026-11-03", entryTime: "14:00" }),
        reading(3, { entryTime: "14:00" }, { by: VERA }),
        reading(2),
        reading(1, { targetId: CHAMBER_2, targetName: "Камера 2" }),
      ],
      CONTEXT,
    );

    expect(grid.times).toEqual(["08:00", "14:00"]);
    expect(grid.blocks.map((block) => block.targetName)).toEqual([
      "Камера 1",
      "Камера 2",
    ]);
    const chamber1 = grid.blocks[0]!;
    expect(chamber1.rows.map((row) => row.date)).toEqual([
      "02.11.2026",
      "03.11.2026",
    ]);
    expect(chamber1.rows[0]!.cells.map((cell) => cell?.text ?? null)).toEqual([
      "2 °C",
      "3 °C",
    ]);
    expect(chamber1.rows[0]!.recordedBy).toEqual([
      "Борис Оператор",
      "Вера Технолог",
    ]);
    expect(chamber1.rows[1]!.cells[0]).toBeNull();
  });

  it("marks a missed check in its cell instead of leaving a silent gap", () => {
    const grid = toReadingsGrid(
      [item({ entryTime: "14:00" }), reading(3)],
      CONTEXT,
    );

    expect(grid.blocks[0]!.rows[0]!.cells[1]).toMatchObject({
      text: "",
      missed: true,
    });
  });

  it("puts a deviation's corrective action on the day's row", () => {
    const grid = toReadingsGrid(
      [
        reading(
          9,
          { entryTime: "14:00" },
          { fails: true, action: "Преместена стока" },
        ),
        reading(3),
      ],
      CONTEXT,
    );

    const row = grid.blocks[0]!.rows[0]!;
    expect(row.cells[1]).toMatchObject({ text: "9 °C", fails: true });
    expect(row.correctiveActions).toEqual([
      { time: "14:00", text: "Преместена стока" },
    ]);
  });

  it("keeps a deviation with no corrective action visible on its row", () => {
    const grid = toReadingsGrid([reading(9, {}, { fails: true })], CONTEXT);

    expect(grid.blocks[0]!.rows[0]!.correctiveActions).toEqual([
      { time: "08:00", text: null },
    ]);
  });

  it("strikes a voided reading and names its time on the row", () => {
    const grid = toReadingsGrid(
      [reading(33, { entryTime: "14:00", displayState: "voided" }), reading(3)],
      CONTEXT,
    );

    const row = grid.blocks[0]!.rows[0]!;
    expect(row.cells[1]).toMatchObject({ text: "33 °C", voided: true });
    expect(row.voidedTimes).toEqual(["14:00"]);
    expect(row.correctiveActions).toEqual([]);
  });

  it("states each item's norm, its own limits winning over the form's", () => {
    const grid = toReadingsGrid(
      [
        reading(3),
        reading(-1, {
          targetId: CHAMBER_2,
          targetName: "Камера 2",
          resolvedLimits: { temperature: { min: -4, max: 2 } },
        }),
      ],
      CONTEXT,
    );

    expect(grid.blocks.map((block) => block.norm)).toEqual([
      "0 до 7",
      "-4 до 2",
    ]);
  });
});

describe("toDailyChecklist", () => {
  it("prints one sheet per day and time, items grouped under their area", () => {
    const checklist = toDailyChecklist(
      [
        cleaned("Цех › Стени", { entryDate: "2026-11-03" }),
        cleaned("Цех › Стени"),
        cleaned("Мивка"),
        cleaned("Цех › Под"),
      ],
      CONTEXT,
    );

    expect(checklist.columns.map((column) => column.label)).toEqual([
      "Преди работа",
      "След работа",
    ]);
    expect(
      checklist.sheets.map((sheet) => ({
        date: sheet.date,
        groups: sheet.groups.map((group) => ({
          area: group.area,
          items: group.rows.map((row) => row.itemName),
        })),
      })),
    ).toEqual([
      {
        date: "02.11.2026",
        groups: [
          { area: null, items: ["Мивка"] },
          { area: "Цех", items: ["Под", "Стени"] },
        ],
      },
      {
        date: "03.11.2026",
        groups: [{ area: "Цех", items: ["Стени"] }],
      },
    ]);
  });

  it("counts each sheet's done, failed and missed checks", () => {
    const checklist = toDailyChecklist(
      [
        cleaned("Мивка"),
        cleaned("Цех › Под", { result: "fail" }),
        item({
          formVersionId: CLEANING_V1,
          targetName: "Цех › Стени",
          targetId: id(),
        }),
      ],
      CONTEXT,
    );

    expect(checklist.sheets[0]!.summary).toEqual({
      total: 3,
      done: 1,
      failed: 1,
      missed: 1,
    });
  });
});

describe("toJournalDocuments", () => {
  it("gives every journal its own shape", () => {
    const documents = toJournalDocuments(
      [
        reading(3),
        cleaned("Цех › Под"),
        cleaned("Цех › Стени"),
        item({
          formVersionId: COOKING_V1,
          title: "Варене",
          targetId: null,
          targetName: null,
        }),
      ],
      CONTEXT,
    );

    expect(
      documents.map((document) => [document.name, document.body.shape]),
    ).toEqual([
      ["Варене", JOURNAL_SHAPE.LOG],
      ["Почистване и дезинфекция", JOURNAL_SHAPE.CHECKLIST],
      ["Хладилни камери", JOURNAL_SHAPE.GRID],
    ]);
  });
});
