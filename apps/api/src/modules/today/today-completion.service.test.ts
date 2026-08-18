import { getWeekdayFromDate, zonedDateString } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const taskTemplateRepository = vi.hoisted(() => ({
  findWithEquipmentById: vi.fn(),
}));
const todayRepository = vi.hoisted(() => ({
  upsertCompletion: vi.fn(),
  deleteCompletion: vi.fn(),
  upsertTemperatureLog: vi.fn(),
}));

vi.mock("../task-templates/task-template.repository.js", () => ({
  taskTemplateRepository,
}));
vi.mock("./today.repository.js", () => ({ todayRepository }));

const { todayCompletionService } = await import("./today-completion.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000l1";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000t1";
const USER_ID = "00000000-0000-4000-8000-0000000000u1";
const SOFIA = "Europe/Sofia";

const completedBy = { id: USER_ID, firstName: "Ann", lastName: "Lee" };

/** 2026-01-15 is a Thursday. */
function templateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    template: {
      id: TEMPLATE_ID,
      title: "Wipe counters",
      type: "cleaning",
      weekdays: ["thursday"],
      scheduledTimes: ["07:00"],
      equipmentId: null,
      ...overrides,
    },
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
  };
}

const db = {
  transaction: async (fn: (tx: unknown) => unknown) => fn(db),
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("todayCompletionService.completeTask — timezone and date guards", () => {
  it("rejects a write for an invalid organization timezone", async () => {
    await expect(
      todayCompletionService.completeTask(
        db,
        LOCATION_ID,
        completedBy,
        { templateId: TEMPLATE_ID, date: "2026-01-15", scheduledTime: "07:00" },
        "Not/AZone",
      ),
    ).rejects.toBeInstanceOf(InternalError);

    expect(taskTemplateRepository.findWithEquipmentById).not.toHaveBeenCalled();
  });

  it("rejects a completion for a date after the organization's current business date", async () => {
    // "now" defaults to the real clock; use a date far enough ahead to always be future.
    await expect(
      todayCompletionService.completeTask(
        db,
        LOCATION_ID,
        completedBy,
        { templateId: TEMPLATE_ID, date: "2999-01-01", scheduledTime: "07:00" },
        SOFIA,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(taskTemplateRepository.findWithEquipmentById).not.toHaveBeenCalled();
  });

  it("accepts a completion for the organization's current business date", async () => {
    const today = zonedDateString(new Date(), SOFIA);

    taskTemplateRepository.findWithEquipmentById.mockResolvedValue(
      templateRow({ weekdays: [getWeekdayFromDate(today)] }),
    );
    todayRepository.upsertCompletion.mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000c1",
      completedAt: new Date(),
    });

    const result = await todayCompletionService.completeTask(
      db,
      LOCATION_ID,
      completedBy,
      { templateId: TEMPLATE_ID, date: today, scheduledTime: "07:00" },
      SOFIA,
    );

    expect(result.status).toBe("completed");
    expect(todayRepository.upsertCompletion).toHaveBeenCalled();
  });

  it("accepts a completion for a past date", async () => {
    taskTemplateRepository.findWithEquipmentById.mockResolvedValue(
      templateRow(),
    );
    todayRepository.upsertCompletion.mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000000c1",
      completedAt: new Date(),
    });

    await expect(
      todayCompletionService.completeTask(
        db,
        LOCATION_ID,
        completedBy,
        { templateId: TEMPLATE_ID, date: "2026-01-15", scheduledTime: "07:00" },
        SOFIA,
      ),
    ).resolves.toMatchObject({ status: "completed" });
  });
});

describe("todayCompletionService.uncompleteTask — future-date guard", () => {
  it("rejects an uncomplete for a future date", async () => {
    await expect(
      todayCompletionService.uncompleteTask(
        db,
        LOCATION_ID,
        { templateId: TEMPLATE_ID, date: "2999-01-01", scheduledTime: "07:00" },
        SOFIA,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(todayRepository.deleteCompletion).not.toHaveBeenCalled();
  });
});
