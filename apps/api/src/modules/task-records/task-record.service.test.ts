import { API_ERROR_CODE, type FormDefinition } from "@haccp/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const taskRecordRepository = vi.hoisted(() => ({
  findOccurrenceForRecording: vi.fn(),
  findRecordForWrite: vi.fn(),
  insertRecord: vi.fn(),
  updateRecordAnswers: vi.fn(),
  replaceReadings: vi.fn(),
  replaceDeviation: vi.fn(),
  voidActiveRecord: vi.fn(),
}));

const formRepository = vi.hoisted(() => ({
  findActiveWithLatestVersion: vi.fn(),
}));

const targetRepository = vi.hoisted(() => ({
  findActiveItem: vi.fn(),
}));

vi.mock("./task-record.repository.js", () => ({ taskRecordRepository }));
vi.mock("../forms/form.repository.js", () => ({ formRepository }));
vi.mock("../targets/target.repository.js", () => ({ targetRepository }));

const { taskRecordService } = await import("./task-record.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000a1";
const OCCURRENCE_ID = "00000000-0000-4000-8000-0000000000b1";
const RECORD_ID = "00000000-0000-4000-8000-0000000000c1";
const USER_ID = "00000000-0000-4000-8000-0000000000d1";
const VERSION_ID = "00000000-0000-4000-8000-0000000000e1";
const TARGET_ID = "00000000-0000-4000-8000-0000000000f1";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000a2";
const TZ = "Europe/Sofia";
// 15:00 in Sofia (UTC+3).
const NOW = new Date("2026-08-19T12:00:00Z");

const SCOPE = {
  locationId: LOCATION_ID,
  occurrenceId: OCCURRENCE_ID,
  actorUserId: USER_ID,
};

const WRITE_SCOPE = {
  locationId: LOCATION_ID,
  recordId: RECORD_ID,
  actorUserId: USER_ID,
};

const FRIDGE: FormDefinition = {
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
      parameter: "temperature",
      unit: "celsius",
      limits: { min: 0, max: 5 },
    },
  ],
  correctiveAction: "required_on_fail",
};

const CLEANING: FormDefinition = {
  fields: [
    { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
  ],
  correctiveAction: "required_on_fail",
};

function makeOccurrence(overrides: Record<string, unknown> = {}) {
  return {
    id: OCCURRENCE_ID,
    locationId: LOCATION_ID,
    taskTemplateId: TEMPLATE_ID,
    title: "Fridge check",
    targetId: TARGET_ID,
    targetName: "Fish fridge",
    occurrenceDate: "2026-08-19",
    scheduledTime: "08:00",
    availableAt: new Date("2026-08-19T00:00:00Z"),
    formVersionId: VERSION_ID,
    definition: FRIDGE,
    resolvedLimits: { temperature: { min: 0, max: 5 } },
    ...overrides,
  };
}

function makeRecordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    locationId: LOCATION_ID,
    taskTemplateId: TEMPLATE_ID,
    occurrenceId: OCCURRENCE_ID,
    title: "Fridge check",
    formVersionId: VERSION_ID,
    targetId: TARGET_ID,
    targetName: "Fish fridge",
    resolvedLimits: { temperature: { min: 0, max: 5 } },
    entryDate: "2026-08-19",
    entryTime: "08:00",
    values: {},
    result: "pass",
    correctiveAction: null,
    createdAt: NOW,
    createdByUserId: USER_ID,
    recordedAt: NOW,
    recordedByUserId: USER_ID,
    voidedAt: null,
    voidedByUserId: null,
    ...overrides,
  };
}

/** The insert/update echo what the service wrote, as the database would. */
function echoWrites() {
  taskRecordRepository.insertRecord.mockImplementation(async (_tx, values) =>
    makeRecordRow(values),
  );
  taskRecordRepository.updateRecordAnswers.mockImplementation(
    async (_tx, _id, values) => makeRecordRow(values),
  );
}

function fakeDb() {
  return {
    transaction: (fn: (tx: unknown) => unknown) => fn("tx"),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  echoWrites();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create", () => {
  it("404s when the occurrence is not found within the location scope", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(null);

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { values: { temperature: 3 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a write before the occurrence's availableAt", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ availableAt: new Date("2026-08-19T12:00:00.001Z") }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { values: { temperature: 3 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a write at exactly availableAt", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ availableAt: NOW }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { values: { temperature: 3 } }),
    ).resolves.toMatchObject({ id: RECORD_ID });
  });

  it("stores a passing reading against the occurrence's own form version", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );

    const result = await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 3 },
      correctiveAction: "ignored on a pass",
    });

    expect(taskRecordRepository.insertRecord).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        occurrenceId: OCCURRENCE_ID,
        formVersionId: VERSION_ID,
        result: "pass",
        correctiveAction: null,
        createdByUserId: USER_ID,
        recordedByUserId: USER_ID,
        recordedAt: NOW,
      }),
    );
    expect(result.values.temperature).toEqual({
      type: "measurement",
      value: 3,
      unit: "celsius",
      min: 0,
      max: 5,
      fails: false,
    });
  });

  it("writes the reading row for the occurrence's target and location", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );

    await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 3 },
    });

    expect(taskRecordRepository.replaceReadings).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      [
        expect.objectContaining({
          taskRecordId: RECORD_ID,
          fieldId: "temperature",
          locationId: LOCATION_ID,
          targetId: TARGET_ID,
          value: "3",
          fails: false,
        }),
      ],
    );
  });

  it("judges against the occurrence's resolved limits, not the form's defaults", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ resolvedLimits: { temperature: { min: 0, max: 2 } } }),
    );

    const result = await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 3 },
      correctiveAction: "Moved fish to the walk-in",
    });

    expect(result.result).toBe("fail");
    expect(result.correctiveAction).toBe("Moved fish to the walk-in");
  });

  it("requires a corrective action for a failing check", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        values: { temperature: 12 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(taskRecordRepository.insertRecord).not.toHaveBeenCalled();
  });

  it("does not require one when the form makes it optional", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        definition: { ...FRIDGE, correctiveAction: "optional" },
      }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        values: { temperature: 12 },
      }),
    ).resolves.toMatchObject({ result: "fail", correctiveAction: null });
  });

  it("saves a failed check without one when the form turns it off", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ definition: { ...FRIDGE, correctiveAction: "off" } }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        values: { temperature: 12 },
      }),
    ).resolves.toMatchObject({ result: "fail", correctiveAction: null });
  });

  it("refuses a corrective action on a form that turns it off, before writing", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ definition: { ...FRIDGE, correctiveAction: "off" } }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        values: { temperature: 12 },
        correctiveAction: "Moved stock",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(taskRecordRepository.insertRecord).not.toHaveBeenCalled();
  });

  it("rejects answers that do not fit the form version, before writing", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        definition: CLEANING,
        resolvedLimits: {},
        targetId: null,
      }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { values: { temperature: 3 } }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(taskRecordRepository.insertRecord).not.toHaveBeenCalled();
  });

  it("writes no readings for a form without measurements", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        definition: CLEANING,
        resolvedLimits: {},
        targetId: null,
      }),
    );

    const result = await taskRecordService.create(fakeDb(), SCOPE, {
      values: { cleaned: true },
    });

    expect(result.result).toBe("not_evaluated");
    expect(taskRecordRepository.replaceReadings).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      [],
    );
  });

  it("copies the occurrence's context onto the record", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );

    await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 3 },
    });

    expect(taskRecordRepository.insertRecord).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        locationId: LOCATION_ID,
        taskTemplateId: TEMPLATE_ID,
        occurrenceId: OCCURRENCE_ID,
        title: "Fridge check",
        targetId: TARGET_ID,
        targetName: "Fish fridge",
        resolvedLimits: { temperature: { min: 0, max: 5 } },
        entryDate: "2026-08-19",
        entryTime: "08:00",
      }),
    );
  });

  it("maps a duplicate record to TASK_RECORD_ALREADY_EXISTS", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );
    taskRecordRepository.insertRecord.mockRejectedValue({ code: "23505" });

    const error = await taskRecordService
      .create(fakeDb(), SCOPE, { values: { temperature: 3 } })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe(API_ERROR_CODE.TASK_RECORD_ALREADY_EXISTS);
  });
});

describe("deviations", () => {
  const WITH_ANSWERS: FormDefinition = {
    ...FRIDGE,
    corrective: {
      answers: [
        { id: "a_moved", label: "Moved product" },
        { id: "a_manager", label: "Notified manager" },
      ],
      multiple: true,
      allowNote: true,
    },
  };

  function occurrenceWith(corrective: Partial<FormDefinition["corrective"]>) {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        definition: {
          ...WITH_ANSWERS,
          corrective: { ...WITH_ANSWERS.corrective, ...corrective },
        },
      }),
    );
  }

  it("saves a failed record's deviation with its answers, in the form's order", async () => {
    occurrenceWith({});

    const result = await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 12 },
      correctiveAnswerIds: ["a_manager", "a_moved"],
      correctiveAction: " Door was open ",
    });

    expect(result.correctiveAction).toBe(
      "Moved product, Notified manager, Door was open",
    );
    expect(result.corrective).toEqual({
      answerIds: ["a_moved", "a_manager"],
      note: "Door was open",
    });
    expect(taskRecordRepository.replaceDeviation).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      {
        row: {
          taskRecordId: RECORD_ID,
          locationId: LOCATION_ID,
          taskTemplateId: TEMPLATE_ID,
          formVersionId: VERSION_ID,
          targetId: TARGET_ID,
          entryDate: "2026-08-19",
          failedFieldIds: ["temperature"],
          note: "Door was open",
          recordedAt: NOW,
          recordedByUserId: USER_ID,
        },
        answers: [
          { answerId: "a_moved", label: "Moved product", position: 0 },
          { answerId: "a_manager", label: "Notified manager", position: 1 },
        ],
      },
    );
  });

  it("clears the deviation when the record passes", async () => {
    occurrenceWith({});

    await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 3 },
      correctiveAnswerIds: ["a_moved"],
    });

    expect(taskRecordRepository.replaceDeviation).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      null,
    );
  });

  it("keeps a deviation for a failed record with nothing recorded about it", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        definition: { ...FRIDGE, correctiveAction: "optional" },
      }),
    );

    await taskRecordService.create(fakeDb(), SCOPE, {
      values: { temperature: 12 },
    });

    expect(taskRecordRepository.replaceDeviation).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      expect.objectContaining({
        row: expect.objectContaining({ note: null }),
        answers: [],
      }),
    );
  });

  it.each([
    ["an answer the form does not have", {}, { correctiveAnswerIds: ["a_other"] }],
    [
      "several answers when the form takes one",
      { multiple: false },
      { correctiveAnswerIds: ["a_moved", "a_manager"] },
    ],
    [
      "a note when the form takes none",
      { allowNote: false },
      { correctiveAnswerIds: ["a_moved"], correctiveAction: "Door was open" },
    ],
    ["nothing when an answer is required", {}, {}],
  ])("rejects %s", async (_name, corrective, input) => {
    occurrenceWith(corrective);

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        values: { temperature: 12 },
        ...input,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(taskRecordRepository.insertRecord).not.toHaveBeenCalled();
  });

  it("rewrites the deviation when a record is edited", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue({
      record: makeRecordRow(),
      definition: WITH_ANSWERS,
      availableAt: new Date("2026-08-19T00:00:00Z"),
    });

    await taskRecordService.update(fakeDb(), WRITE_SCOPE, {
      values: { temperature: 9 },
      correctiveAnswerIds: ["a_manager"],
    });

    expect(taskRecordRepository.replaceDeviation).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      expect.objectContaining({
        answers: [
          { answerId: "a_manager", label: "Notified manager", position: 0 },
        ],
      }),
    );
  });
});

describe("update", () => {
  function found(overrides: Record<string, unknown> = {}) {
    return {
      record: makeRecordRow(overrides),
      definition: FRIDGE,
      availableAt: new Date("2026-08-19T00:00:00Z"),
    };
  }

  it("404s when the record is not found within the location scope", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue(null);

    await expect(
      taskRecordService.update(fakeDb(), WRITE_SCOPE, {
        values: { temperature: 3 },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("replaces the answers and readings, re-judged against the record's own limits", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue(found());

    const result = await taskRecordService.update(fakeDb(), WRITE_SCOPE, {
      values: { temperature: 9 },
      correctiveAction: "Called the engineer",
    });

    expect(taskRecordRepository.updateRecordAnswers).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      expect.objectContaining({
        result: "fail",
        correctiveAction: "Called the engineer",
        recordedAt: NOW,
        recordedByUserId: USER_ID,
      }),
    );
    expect(result.result).toBe("fail");
    expect(taskRecordRepository.replaceReadings).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      [expect.objectContaining({ value: "9", fails: true })],
    );
  });

  it("reactivates a voided record", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue(
      found({
        voidedAt: new Date("2026-08-19T09:00:00Z"),
        voidedByUserId: USER_ID,
      }),
    );

    const result = await taskRecordService.update(fakeDb(), WRITE_SCOPE, {
      values: { temperature: 3 },
    });

    expect(result.active).toBe(true);
    expect(result.voidedAt).toBeNull();
  });
});

describe("remove", () => {
  it("404s an already-voided record", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue({
      record: makeRecordRow({ voidedAt: NOW, voidedByUserId: USER_ID }),
      definition: FRIDGE,
      availableAt: null,
    });

    await expect(
      taskRecordService.remove(fakeDb(), WRITE_SCOPE),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(taskRecordRepository.voidActiveRecord).not.toHaveBeenCalled();
  });

  it("voids the active record, keeping its answers", async () => {
    taskRecordRepository.findRecordForWrite.mockResolvedValue({
      record: makeRecordRow(),
      definition: FRIDGE,
      availableAt: null,
    });
    taskRecordRepository.voidActiveRecord.mockResolvedValue(
      makeRecordRow({
        values: {
          temperature: {
            type: "measurement",
            value: 3,
            unit: "celsius",
            min: 0,
            max: 5,
            fails: false,
          },
        },
        voidedAt: NOW,
        voidedByUserId: USER_ID,
      }),
    );

    const result = await taskRecordService.remove(fakeDb(), WRITE_SCOPE);

    expect(result.active).toBe(false);
    expect(result.values.temperature).toMatchObject({ value: 3 });
    expect(taskRecordRepository.replaceReadings).not.toHaveBeenCalled();
  });
});

describe("createOnDemand", () => {
  const FORM_ID = "00000000-0000-4000-8000-0000000000a3";
  const ORG_ID = "00000000-0000-4000-8000-0000000000a4";
  const ON_DEMAND_SCOPE = {
    organizationId: ORG_ID,
    locationId: LOCATION_ID,
    formId: FORM_ID,
    actorUserId: USER_ID,
    timeZone: TZ,
  };

  function makeForm(
    overrides: Record<string, unknown> = {},
    definition: FormDefinition = FRIDGE,
  ) {
    return {
      form: {
        id: FORM_ID,
        organizationId: ORG_ID,
        name: "Cooling log",
        category: "temperature",
        appliesTo: "per_item",
        onDemand: true,
        archivedAt: null,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-08-01T00:00:00Z"),
        ...overrides,
      },
      latestVersion: {
        id: VERSION_ID,
        formId: FORM_ID,
        version: 1,
        definition,
        createdAt: new Date("2026-08-01T00:00:00Z"),
      },
    };
  }

  function input(overrides: Record<string, unknown> = {}) {
    return {
      values: { temperature: 2 },
      formVersionId: VERSION_ID,
      targetId: TARGET_ID,
      entryDate: "2026-08-19",
      entryTime: "14:40",
      ...overrides,
    };
  }

  beforeEach(() => {
    targetRepository.findActiveItem.mockResolvedValue({
      targetId: TARGET_ID,
      targetName: "Blast chiller",
    });
  });

  it("stores a record with no task or occurrence, judged by the form's own limits", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(makeForm());

    const result = await taskRecordService.createOnDemand(
      fakeDb(),
      ON_DEMAND_SCOPE,
      input({ values: { temperature: 4 } }),
    );

    expect(formRepository.findActiveWithLatestVersion).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      FORM_ID,
    );
    expect(targetRepository.findActiveItem).toHaveBeenCalledWith(
      expect.anything(),
      LOCATION_ID,
      TARGET_ID,
    );
    expect(taskRecordRepository.insertRecord).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        locationId: LOCATION_ID,
        occurrenceId: null,
        taskTemplateId: null,
        title: "Cooling log",
        formVersionId: VERSION_ID,
        targetId: TARGET_ID,
        targetName: "Blast chiller",
        resolvedLimits: { temperature: { min: 0, max: 5 } },
        entryDate: "2026-08-19",
        entryTime: "14:40",
        recordedAt: NOW,
        result: "pass",
      }),
    );
    expect(result).toMatchObject({ kind: "on_demand", occurrenceId: null });
    expect(taskRecordRepository.replaceReadings).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      [expect.objectContaining({ targetId: TARGET_ID, value: "4" })],
    );
  });

  it("404s a form that is missing, archived or not loggable when needed", async () => {
    for (const found of [null, makeForm({ onDemand: false })]) {
      formRepository.findActiveWithLatestVersion.mockResolvedValue(found);

      await expect(
        taskRecordService.createOnDemand(fakeDb(), ON_DEMAND_SCOPE, input()),
      ).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(taskRecordRepository.insertRecord).not.toHaveBeenCalled();
  });

  it("refuses answers filled against an older form version", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(makeForm());

    const error = await taskRecordService
      .createOnDemand(
        fakeDb(),
        ON_DEMAND_SCOPE,
        input({ formVersionId: "00000000-0000-4000-8000-0000000000e2" }),
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe(API_ERROR_CODE.FORM_VERSION_CHANGED);
  });

  it("requires an active item at this location for a per-item form", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(makeForm());

    await expect(
      taskRecordService.createOnDemand(
        fakeDb(),
        ON_DEMAND_SCOPE,
        input({ targetId: null }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    targetRepository.findActiveItem.mockResolvedValue(null);
    await expect(
      taskRecordService.createOnDemand(fakeDb(), ON_DEMAND_SCOPE, input()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses an item for a whole-location form", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(
      makeForm({ appliesTo: "location" }, CLEANING),
    );

    await expect(
      taskRecordService.createOnDemand(
        fakeDb(),
        ON_DEMAND_SCOPE,
        input({ values: { cleaned: true } }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses an entry in the future", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(makeForm());

    await expect(
      taskRecordService.createOnDemand(
        fakeDb(),
        ON_DEMAND_SCOPE,
        input({ entryTime: "15:30" }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
