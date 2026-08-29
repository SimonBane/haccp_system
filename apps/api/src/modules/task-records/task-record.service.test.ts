import { API_ERROR_CODE } from "@haccp/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const taskRecordRepository = vi.hoisted(() => ({
  findOccurrenceForRecording: vi.fn(),
  findRecordChain: vi.fn(),
  insertRecord: vi.fn(),
  insertTemperatureDetail: vi.fn(),
  updateRecordForReactivation: vi.fn(),
  replaceTemperatureDetail: vi.fn(),
  voidActiveRecord: vi.fn(),
}));

vi.mock("./task-record.repository.js", () => ({ taskRecordRepository }));

const { taskRecordService } = await import("./task-record.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000l1";
const OCCURRENCE_ID = "00000000-0000-4000-8000-0000000000x1";
const RECORD_ID = "00000000-0000-4000-8000-0000000000r1";
const USER_ID = "00000000-0000-4000-8000-0000000000u1";

const SCOPE = {
  locationId: LOCATION_ID,
  occurrenceId: OCCURRENCE_ID,
  actorUserId: USER_ID,
};

function makeOccurrence(overrides: Record<string, unknown> = {}) {
  return {
    id: OCCURRENCE_ID,
    type: "temperature",
    occurrenceDate: "2026-08-19",
    availableAt: new Date("2026-08-19T00:00:00Z"),
    dueAt: new Date("2026-08-19T08:00:00Z"),
    minTempC: "0.0",
    maxTempC: "5.0",
    ...overrides,
  };
}

function makeChain(overrides: Record<string, unknown> = {}) {
  return {
    recordId: RECORD_ID,
    occurrenceId: OCCURRENCE_ID,
    createdAt: new Date("2026-08-19T08:00:00Z"),
    createdByUserId: USER_ID,
    recordedAt: new Date("2026-08-19T08:00:00Z"),
    recordedByUserId: USER_ID,
    voidedAt: null,
    voidedByUserId: null,
    occurrenceType: "temperature",
    occurrenceDate: "2026-08-19",
    availableAt: new Date("2026-08-19T00:00:00Z"),
    dueAt: new Date("2026-08-19T08:00:00Z"),
    minTempC: "0.0",
    maxTempC: "5.0",
    detailRecordedC: "3.0",
    detailMinTempC: "0.0",
    detailMaxTempC: "5.0",
    detailResult: "ok",
    detailCorrectiveAction: null,
    ...overrides,
  };
}

function makeRecordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    occurrenceId: OCCURRENCE_ID,
    createdAt: new Date("2026-08-19T08:00:00Z"),
    createdByUserId: USER_ID,
    recordedAt: new Date("2026-08-19T08:00:00Z"),
    recordedByUserId: USER_ID,
    voidedAt: null,
    voidedByUserId: null,
    ...overrides,
  };
}

function fakeDb() {
  return {
    transaction: (fn: (tx: unknown) => unknown) => fn("tx"),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-19T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create", () => {
  it("404s when the occurrence is not found within the location/organization scope", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(null);

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a write before the occurrence's availableAt", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        type: "cleaning",
        availableAt: new Date("2026-08-19T12:00:00.001Z"), // one ms after the fixed now
      }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a write at exactly availableAt", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        type: "cleaning",
        availableAt: new Date("2026-08-19T12:00:00.000Z"), // exactly the fixed now
      }),
    );
    taskRecordRepository.insertRecord.mockResolvedValue(makeRecordRow());

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).resolves.toMatchObject({ id: RECORD_ID });
  });

  it("accepts a late, no-deadline write long after availableAt", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({
        type: "cleaning",
        availableAt: new Date("2020-01-01T00:00:00Z"),
        dueAt: null,
      }),
    );
    taskRecordRepository.insertRecord.mockResolvedValue(makeRecordRow());

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).resolves.toMatchObject({ id: RECORD_ID });
  });

  it("rejects an ordinary payload against a temperature occurrence", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ type: "temperature" }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a temperature payload against a cleaning occurrence", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ type: "cleaning" }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        kind: "temperature",
        recordedC: 3,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an out-of-range reading with no corrective action", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        kind: "temperature",
        recordedC: 12,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("normalizes an in-range reading's corrective action to null even if supplied", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );
    taskRecordRepository.insertRecord.mockResolvedValue(makeRecordRow());
    taskRecordRepository.insertTemperatureDetail.mockResolvedValue({
      taskRecordId: RECORD_ID,
      recordedC: "3.0",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "ok",
      correctiveAction: null,
    });

    await taskRecordService.create(fakeDb(), SCOPE, {
      kind: "temperature",
      recordedC: 3,
      correctiveAction: "not needed",
    });

    expect(taskRecordRepository.insertTemperatureDetail).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ result: "ok", correctiveAction: null }),
    );
  });

  it("stores a trimmed corrective action for an out-of-range reading", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );
    taskRecordRepository.insertRecord.mockResolvedValue(makeRecordRow());
    taskRecordRepository.insertTemperatureDetail.mockResolvedValue({
      taskRecordId: RECORD_ID,
      recordedC: "12.0",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "out_of_range",
      correctiveAction: "Moved stock",
    });

    await taskRecordService.create(fakeDb(), SCOPE, {
      kind: "temperature",
      recordedC: 12,
      correctiveAction: "  Moved stock  ",
    });

    expect(taskRecordRepository.insertTemperatureDetail).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({
        result: "out_of_range",
        correctiveAction: "Moved stock",
      }),
    );
  });

  it("maps a unique violation on insert to 409 without overwriting", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence({ type: "cleaning" }),
    );
    taskRecordRepository.insertRecord.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "23505" }),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toMatchObject({
      code: API_ERROR_CODE.TASK_RECORD_ALREADY_EXISTS,
    });
  });

  it("rolls the transaction's error up when the temperature detail insert fails", async () => {
    taskRecordRepository.findOccurrenceForRecording.mockResolvedValue(
      makeOccurrence(),
    );
    taskRecordRepository.insertRecord.mockResolvedValue(makeRecordRow());
    taskRecordRepository.insertTemperatureDetail.mockRejectedValue(
      new Error("detail insert failed"),
    );

    await expect(
      taskRecordService.create(fakeDb(), SCOPE, {
        kind: "temperature",
        recordedC: 3,
      }),
    ).rejects.toThrow("detail insert failed");

    expect(taskRecordRepository.insertRecord).toHaveBeenCalledTimes(1);
  });
});

describe("update", () => {
  it("404s when there is no existing record for the occurrence", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(null);

    await expect(
      taskRecordService.update(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a reactivation before the occurrence's availableAt", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(
      makeChain({ availableAt: new Date("2026-08-19T12:00:00.001Z") }),
    );

    await expect(
      taskRecordService.update(fakeDb(), SCOPE, { kind: "ordinary" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("revalidates the payload kind against the immutable occurrence type, not any prior detail", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(
      makeChain({ occurrenceType: "cleaning" }),
    );

    await expect(
      taskRecordService.update(fakeDb(), SCOPE, {
        kind: "temperature",
        recordedC: 3,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("replaces the current temperature detail and attribution on the joined occurrence range", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(makeChain());
    taskRecordRepository.updateRecordForReactivation.mockResolvedValue(
      makeRecordRow({ recordedByUserId: USER_ID }),
    );
    taskRecordRepository.replaceTemperatureDetail.mockResolvedValue({
      taskRecordId: RECORD_ID,
      recordedC: "1.0",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "ok",
      correctiveAction: null,
    });

    const response = await taskRecordService.update(fakeDb(), SCOPE, {
      kind: "temperature",
      recordedC: 1,
    });

    expect(taskRecordRepository.replaceTemperatureDetail).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      expect.objectContaining({ minTempC: "0", maxTempC: "5" }),
    );
    expect(response.temperature?.recordedC).toBe(1);
  });

  it("clears void attribution when reactivating a voided record", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(
      makeChain({
        occurrenceType: "cleaning",
        voidedAt: new Date("2026-08-19T09:00:00Z"),
        voidedByUserId: USER_ID,
        detailRecordedC: null,
        detailMinTempC: null,
        detailMaxTempC: null,
        detailResult: null,
        detailCorrectiveAction: null,
      }),
    );
    taskRecordRepository.updateRecordForReactivation.mockResolvedValue(
      makeRecordRow({ voidedAt: null, voidedByUserId: null }),
    );

    const response = await taskRecordService.update(fakeDb(), SCOPE, {
      kind: "ordinary",
    });

    expect(
      taskRecordRepository.updateRecordForReactivation,
    ).toHaveBeenCalledWith(
      "tx",
      RECORD_ID,
      expect.objectContaining({ recordedByUserId: USER_ID }),
    );
    expect(response.active).toBe(true);
    expect(response.voidedAt).toBeNull();
    expect(response.voidedByUserId).toBeNull();
  });
});

describe("remove", () => {
  it("404s when there is no record for the occurrence", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(null);

    await expect(
      taskRecordService.remove(fakeDb(), SCOPE),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s a repeated void of an already-voided record", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(
      makeChain({ voidedAt: new Date("2026-08-19T09:00:00Z") }),
    );

    await expect(
      taskRecordService.remove(fakeDb(), SCOPE),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("voids an active record and keeps its temperature detail untouched in the response", async () => {
    taskRecordRepository.findRecordChain.mockResolvedValue(makeChain());
    taskRecordRepository.voidActiveRecord.mockResolvedValue(
      makeRecordRow({
        voidedAt: new Date("2026-08-19T12:00:00Z"),
        voidedByUserId: USER_ID,
      }),
    );

    const response = await taskRecordService.remove(fakeDb(), SCOPE);

    expect(response.active).toBe(false);
    expect(response.voidedByUserId).toBe(USER_ID);
    expect(response.temperature).toEqual({
      recordedC: 3,
      minTempC: 0,
      maxTempC: 5,
      result: "ok",
      correctiveAction: null,
    });
    expect(taskRecordRepository.insertTemperatureDetail).not.toHaveBeenCalled();
  });
});
