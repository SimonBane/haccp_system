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
  findRecordChain: vi.fn(),
  insertRecord: vi.fn(),
  updateRecordAnswers: vi.fn(),
  replaceReadings: vi.fn(),
  voidActiveRecord: vi.fn(),
}));

vi.mock("./task-record.repository.js", () => ({ taskRecordRepository }));

const { taskRecordService } = await import("./task-record.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000a1";
const OCCURRENCE_ID = "00000000-0000-4000-8000-0000000000b1";
const RECORD_ID = "00000000-0000-4000-8000-0000000000c1";
const USER_ID = "00000000-0000-4000-8000-0000000000d1";
const VERSION_ID = "00000000-0000-4000-8000-0000000000e1";
const TARGET_ID = "00000000-0000-4000-8000-0000000000f1";
const NOW = new Date("2026-08-19T12:00:00Z");

const SCOPE = {
  locationId: LOCATION_ID,
  occurrenceId: OCCURRENCE_ID,
  actorUserId: USER_ID,
};

const FRIDGE: FormDefinition = {
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
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
    targetId: TARGET_ID,
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
    occurrenceId: OCCURRENCE_ID,
    formVersionId: VERSION_ID,
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

describe("update", () => {
  function chain(overrides: Record<string, unknown> = {}) {
    return { record: makeRecordRow(overrides), occurrence: makeOccurrence() };
  }

  it("404s when there is no record yet", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(null);

    await expect(
      taskRecordService.update(fakeDb(), SCOPE, { values: { temperature: 3 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("replaces the answers and readings, re-judged against the same occurrence", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(chain());

    const result = await taskRecordService.update(fakeDb(), SCOPE, {
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
    taskRecordRepository.findRecordChain.mockResolvedValue(
      chain({
        voidedAt: new Date("2026-08-19T09:00:00Z"),
        voidedByUserId: USER_ID,
      }),
    );

    const result = await taskRecordService.update(fakeDb(), SCOPE, {
      values: { temperature: 3 },
    });

    expect(result.active).toBe(true);
    expect(result.voidedAt).toBeNull();
  });
});

describe("remove", () => {
  it("404s an already-voided record", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue({
      record: makeRecordRow({ voidedAt: NOW, voidedByUserId: USER_ID }),
      occurrence: makeOccurrence(),
    });

    await expect(
      taskRecordService.remove(fakeDb(), SCOPE),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(taskRecordRepository.voidActiveRecord).not.toHaveBeenCalled();
  });

  it("voids the active record, keeping its answers", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue({
      record: makeRecordRow(),
      occurrence: makeOccurrence(),
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

    const result = await taskRecordService.remove(fakeDb(), SCOPE);

    expect(result.active).toBe(false);
    expect(result.values.temperature).toMatchObject({ value: 3 });
    expect(taskRecordRepository.replaceReadings).not.toHaveBeenCalled();
  });
});
