import type {
  FormVersionSummary,
  FormVersionSummaryMap,
  RecordItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import { formatLimits } from "@/features/forms/lib/measurement";
import { toDeviationRows, type DeviationRowContext } from "./deviation-rows";
import {
  ENTRY_LOG_PORTRAIT_MAX_FIELDS,
  entryLogColumns,
  toEntryLog,
} from "./entry-log";
import { splitIntoJournals, summarizeJournal } from "./journals";

const FRIDGE_FORM = "66666666-6666-4666-8666-666666666666";
const COOKING_FORM = "77777777-7777-4777-8777-777777777777";
const FRIDGE_V1 = "55555555-5555-4555-8555-555555555551";
const FRIDGE_V2 = "55555555-5555-4555-8555-555555555552";
const COOKING_V1 = "88888888-8888-4888-8888-888888888881";

function version(
  overrides: Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">,
): FormVersionSummary {
  return {
    formId: FRIDGE_FORM,
    formName: "Хладилници",
    category: "temperature",
    version: 1,
    definition: {
      correctiveAction: "required_on_fail",
      fields: [
        {
          id: "temperature",
          type: "measurement",
          label: "Температура",
          required: true,
          parameter: "temperature",
          unit: "celsius",
          limits: { min: 0, max: 4 },
        },
      ],
    },
    ...overrides,
  } as FormVersionSummary;
}

const FORM_VERSIONS: FormVersionSummaryMap = {
  [FRIDGE_V1]: version({ id: FRIDGE_V1, formName: "Хладилници (стар)" }),
  [FRIDGE_V2]: version({
    id: FRIDGE_V2,
    version: 2,
    definition: {
      correctiveAction: "required_on_fail",
      fields: [
        {
          id: "door",
          type: "checkbox",
          label: "Вратата е затворена",
          required: true,
        },
        {
          id: "temperature",
          type: "measurement",
          label: "Температура в камерата",
          required: true,
          parameter: "temperature",
          unit: "celsius",
          limits: { min: 0, max: 4 },
        },
      ],
    },
  } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">),
  [COOKING_V1]: version({
    id: COOKING_V1,
    formId: COOKING_FORM,
    formName: "Термична обработка",
    definition: {
      correctiveAction: "optional",
      fields: [
        { id: "product", type: "text", label: "Продукт", required: true },
        {
          id: "core",
          type: "measurement",
          label: "Температура в центъра",
          required: true,
          parameter: "core_temperature",
          unit: "celsius",
          limits: { min: 72, max: null },
        },
      ],
    },
  } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">),
};

const FORMAT = buildAnswerFormatters({
  locale: "bg",
  symbol: (unit) => (unit === "celsius" ? "°C" : unit),
  yes: "Да",
  no: "Не",
});

let nextId = 0;
function id(): string {
  nextId += 1;
  return `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
}

const BORIS = { id: id(), firstName: "Борис", lastName: "Оператор" };

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
    title: "Хладилници",
    formVersionId: FRIDGE_V2,
    category: "temperature",
    targetId: id(),
    targetName: "Хладилник 1",
    resolvedLimits: { temperature: { min: 0, max: 4 } },
    displayState: "missed",
    recordState: "none",
    timing: "not_submitted",
    result: "not_evaluated",
    record: null,
    ...overrides,
  } as RecordItem;
}

function recorded(
  values: Record<string, unknown>,
  overrides: Partial<RecordItem> = {},
  correctiveAction: string | null = null,
): RecordItem {
  return item({
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
      values,
      correctiveAction,
    } as RecordItem["record"],
    ...overrides,
  });
}

function temperature(value: number, fails = false) {
  return {
    temperature: {
      type: "measurement",
      value,
      unit: "celsius",
      min: 0,
      max: 4,
      fails,
    },
  };
}

describe("splitIntoJournals", () => {
  it("groups by form across versions, keeps API order and names journals by the newest version", () => {
    const first = recorded(temperature(3), { formVersionId: FRIDGE_V1 });
    const cooking = recorded(
      { product: { type: "text", value: "Кренвирши" } },
      { formVersionId: COOKING_V1, title: "Термична обработка" },
    );
    const second = recorded(temperature(2));

    const journals = splitIntoJournals([first, cooking, second], FORM_VERSIONS);

    expect(journals.map((journal) => journal.name)).toEqual([
      "Термична обработка",
      "Хладилници",
    ]);
    expect(journals[1]!.id).toBe(FRIDGE_FORM);
    expect(journals[1]!.items).toEqual([first, second]);
  });

  it("falls back to the row title when the version is missing", () => {
    const orphan = item({ formVersionId: id(), title: "Стара проверка" });

    expect(splitIntoJournals([orphan], {})).toEqual([
      { id: orphan.formVersionId, name: "Стара проверка", items: [orphan] },
    ]);
  });

  it("summarizes done, late, failed and missed checks", () => {
    const [journal] = splitIntoJournals(
      [
        recorded(temperature(3)),
        recorded(temperature(3), { timing: "late" }),
        recorded(temperature(9, true), { result: "fail" }),
        recorded(temperature(3), {
          displayState: "voided",
          recordState: "voided",
        }),
        item(),
        item({ displayState: "open" }),
      ],
      FORM_VERSIONS,
    );

    expect(summarizeJournal(journal!)).toMatchObject({
      total: 6,
      done: 3,
      late: 1,
      failed: 1,
      missed: 1,
    });
  });
});

describe("entryLogColumns", () => {
  it("orders by the newest version and keeps a field only an older version had", () => {
    const old = version({
      id: id(),
      definition: {
        correctiveAction: "optional",
        fields: [
          { id: "note", type: "text", label: "Бележка", required: false },
          {
            id: "temperature",
            type: "measurement",
            label: "Температура",
            required: true,
            parameter: "temperature",
            unit: "celsius",
            limits: { min: 0, max: 4 },
          },
        ],
      },
    } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">);

    expect(entryLogColumns([old, FORM_VERSIONS[FRIDGE_V2]!])).toEqual([
      { fieldId: "door", label: "Вратата е затворена", numeric: false },
      {
        fieldId: "temperature",
        label: "Температура в камерата",
        numeric: true,
      },
      { fieldId: "note", label: "Бележка", numeric: false },
    ]);
  });
});

describe("toEntryLog", () => {
  const context = { formVersions: FORM_VERSIONS, format: FORMAT };

  it("puts each answer in its field's column and marks a failed one", () => {
    const log = toEntryLog(
      [
        recorded(
          {
            door: { type: "checkbox", value: true },
            ...temperature(7.5, true),
          },
          { result: "fail" },
          "Преместена стока",
        ),
      ],
      context,
    );

    expect(log.columns.map((column) => column.fieldId)).toEqual([
      "door",
      "temperature",
    ]);
    expect(log.rows[0]!.cells).toEqual([
      { text: "Да", fails: false },
      { text: "7,5 °C", fails: true },
    ]);
    expect(log.rows[0]).toMatchObject({
      status: "fail",
      correctiveAction: "Преместена стока",
      recordedBy: "Борис Оператор",
    });
  });

  it("leaves an empty cell for a field the record's version did not have", () => {
    const log = toEntryLog(
      [
        recorded(temperature(3), { formVersionId: FRIDGE_V1 }),
        recorded(temperature(2)),
      ],
      context,
    );

    expect(log.rows[0]!.cells).toEqual([null, { text: "3 °C", fails: false }]);
  });

  it("prints a missed check with no answers and no author", () => {
    const log = toEntryLog([item()], context);

    expect(log.rows[0]).toMatchObject({
      status: "missed",
      cells: [null, null],
    });
    expect(log.rows[0]).not.toHaveProperty("recordedBy");
  });

  it("gives each item its own group, in name order, rows in API order", () => {
    const fridgeTwo = id();
    const first = recorded(temperature(3), {
      targetId: fridgeTwo,
      targetName: "Хладилник 2",
    });
    const second = recorded(temperature(2));
    const third = item({ targetId: fridgeTwo, targetName: "Хладилник 2" });

    const log = toEntryLog([first, second, third], context);

    expect(log.groups.map((group) => group.targetName)).toEqual([
      "Хладилник 1",
      "Хладилник 2",
    ]);
    expect(log.groups[1]!.rows.map((row) => row.id)).toEqual([
      first.id,
      third.id,
    ]);
  });

  it("keeps an item together after a rename and names it as last recorded", () => {
    const fridge = id();
    const log = toEntryLog(
      [
        recorded(temperature(3), { targetId: fridge, targetName: "Хладилник" }),
        recorded(temperature(2), {
          targetId: fridge,
          targetName: "Хладилник 1",
        }),
      ],
      context,
    );

    expect(log.groups).toHaveLength(1);
    expect(log.groups[0]!.targetName).toBe("Хладилник 1");
  });

  it("prints a form logged for the whole location as one group with no item", () => {
    const log = toEntryLog(
      [
        recorded(
          { product: { type: "text", value: "Кренвирши" } },
          {
            formVersionId: COOKING_V1,
            targetId: null,
            targetName: null,
            kind: "on_demand",
          },
        ),
      ],
      context,
    );

    expect(log.groups).toHaveLength(1);
    expect(log.groups[0]!.targetName).toBeNull();
    expect(log.rows[0]!.onDemand).toBe(true);
  });

  it("states each column's norm for the item, from the limits its newest check used", () => {
    const fridge = id();
    const log = toEntryLog(
      [
        recorded(temperature(3), { targetId: fridge }),
        recorded(temperature(1), {
          targetId: fridge,
          entryDate: "2026-11-03",
          resolvedLimits: { temperature: { min: -2, max: 2 } },
        }),
      ],
      { ...context, limits: (limits) => `${limits.min} до ${limits.max}` },
    );

    expect(log.groups[0]!.norms).toEqual([null, "-2 до 2"]);
  });

  it("names the passing answers of a choice that can fail as its norm", () => {
    const seal = version({
      id: id(),
      definition: {
        correctiveAction: "required_on_fail",
        fields: [
          {
            id: "seal",
            type: "choice",
            label: "Уплътнение",
            required: true,
            multiple: false,
            options: [
              { id: "ok", label: "Цяло", fails: false },
              { id: "worn", label: "Износено", fails: true },
            ],
          },
          { id: "note", type: "text", label: "Бележка", required: false },
        ],
      },
    } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">);

    const log = toEntryLog([item({ formVersionId: seal.id })], {
      formVersions: { [seal.id]: seal },
      format: FORMAT,
      limits: () => null,
    });

    expect(log.groups[0]!.norms).toEqual(["Цяло", null]);
  });

  it("gathers an item's checks by day so each date prints once", () => {
    const fridge = id();
    const log = toEntryLog(
      [
        recorded(temperature(3), { targetId: fridge }),
        recorded(temperature(2), { targetId: fridge, entryTime: "18:00" }),
        recorded(temperature(1), { targetId: fridge, entryDate: "2026-11-03" }),
      ],
      context,
    );

    expect(
      log.groups[0]!.days.map((day) => [day.date, day.rows.length]),
    ).toEqual([
      ["02.11.2026", 2],
      ["03.11.2026", 1],
    ]);
  });

  it("goes landscape only above the portrait field limit", () => {
    const fields = Array.from(
      { length: ENTRY_LOG_PORTRAIT_MAX_FIELDS + 1 },
      (_, index) => ({
        id: `field${index}`,
        type: "text" as const,
        label: `Поле ${index}`,
        required: false,
      }),
    );
    const wide = version({
      id: id(),
      definition: { correctiveAction: "optional", fields },
    } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">);

    const versions = { [wide.id]: wide };
    expect(
      toEntryLog([item({ formVersionId: wide.id })], {
        formVersions: versions,
        format: FORMAT,
      }).wide,
    ).toBe(true);
    expect(toEntryLog([item()], context).wide).toBe(false);
  });
});

describe("toDeviationRows", () => {
  const context: DeviationRowContext = {
    formVersions: FORM_VERSIONS,
    format: FORMAT,
    limits: (limits, unit) =>
      formatLimits(limits, unit, "bg", unit === "celsius" ? "°C" : unit, "до"),
  };

  it("lists each failed answer with the limit stored on the record", () => {
    const failed = recorded(
      { door: { type: "checkbox", value: true }, ...temperature(7.5, true) },
      { result: "fail", resolvedLimits: { temperature: { min: 0, max: 5 } } },
      "Преместена стока, Сервиз",
    );

    expect(toDeviationRows([failed], context)).toEqual([
      expect.objectContaining({
        failed: [
          {
            label: "Температура в камерата",
            text: "7,5 °C",
            limit: "0 до 5 °C",
          },
        ],
        correctiveAction: "Преместена стока, Сервиз",
        recordedBy: "Борис Оператор",
        targetName: "Хладилник 1",
      }),
    ]);
  });

  it("leaves out passing, missed and voided rows", () => {
    const voided = recorded(temperature(9, true), {
      result: "fail",
      displayState: "voided",
      recordState: "voided",
    });

    expect(
      toDeviationRows([recorded(temperature(3)), item(), voided], context),
    ).toEqual([]);
  });

  it("prints no limit for a failed choice", () => {
    const versions: FormVersionSummaryMap = {
      [FRIDGE_V2]: version({
        id: FRIDGE_V2,
        definition: {
          correctiveAction: "required_on_fail",
          fields: [
            {
              id: "state",
              type: "choice",
              label: "Състояние",
              required: true,
              multiple: false,
              options: [
                { id: "clean", label: "Чисто", fails: false },
                { id: "dirty", label: "Мръсно", fails: true },
              ],
            },
          ],
        },
      } as Partial<FormVersionSummary> & Pick<FormVersionSummary, "id">),
    };

    const rows = toDeviationRows(
      [
        recorded(
          { state: { type: "choice", value: ["dirty"], fails: true } },
          { result: "fail", resolvedLimits: {} },
        ),
      ],
      { ...context, formVersions: versions },
    );

    expect(rows[0]!.failed).toEqual([
      { label: "Състояние", text: "Мръсно", limit: null },
    ]);
  });
});
