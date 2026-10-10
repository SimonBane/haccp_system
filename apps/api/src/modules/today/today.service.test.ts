import { describe, expect, it, vi } from "vitest";
import { InternalError } from "../../core/errors/app-errors.js";

const todayRepository = vi.hoisted(() => ({
  findOccurrencesWithRecords: vi.fn(),
}));

const formRepository = vi.hoisted(() => ({
  findVersionSummariesByIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("./today.repository.js", () => ({ todayRepository }));
vi.mock("../forms/form.repository.js", () => ({ formRepository }));

const { todayService } = await import("./today.service.js");

const LOCATION = "00000000-0000-4000-8000-0000000000l1";
const USER = "00000000-0000-4000-8000-0000000000u1";

function occurrenceRow(overrides: Record<string, unknown> = {}) {
  return {
    occurrenceId: "00000000-0000-4000-8000-00000000000a",
    taskTemplateId: "00000000-0000-4000-8000-00000000000t",
    title: "Wipe counters",
    formVersionId: "00000000-0000-4000-8000-0000000000f1",
    targetId: null,
    targetName: null,
    resolvedLimits: {},
    scheduledTime: "07:00",
    occurrenceDate: "2026-01-15",
    availableAt: new Date("2026-01-15T00:00:00Z"),
    dueAt: new Date("2026-01-15T07:00:00Z"),
    recordedAt: null,
    recordedByUserId: null,
    recordedByFirstName: null,
    recordedByLastName: null,
    voidedAt: null,
    result: null,
    values: null,
    correctiveAction: null,
    ...overrides,
  };
}

describe("todayService.getToday — timezone guard", () => {
  it("rejects a read for an invalid organization timezone", async () => {
    await expect(
      todayService.getToday(
        {} as never,
        LOCATION,
        "2026-01-15",
        USER,
        "Not/AZone",
      ),
    ).rejects.toBeInstanceOf(InternalError);

    expect(todayRepository.findOccurrencesWithRecords).not.toHaveBeenCalled();
  });
});

describe("todayService.getToday — grouping", () => {
  it("groups occurrences into morning/afternoon/evening by scheduled time", async () => {
    todayRepository.findOccurrencesWithRecords.mockResolvedValueOnce([
      occurrenceRow({
        occurrenceId: "00000000-0000-4000-8000-00000000000a",
        scheduledTime: "07:00",
      }),
      occurrenceRow({
        occurrenceId: "00000000-0000-4000-8000-00000000000b",
        scheduledTime: "14:00",
      }),
      occurrenceRow({
        occurrenceId: "00000000-0000-4000-8000-00000000000c",
        scheduledTime: "19:00",
      }),
    ]);

    const result = await todayService.getToday(
      {} as never,
      LOCATION,
      "2026-01-15",
      USER,
      "Europe/Sofia",
    );

    expect(result.sections.morning).toHaveLength(1);
    expect(result.sections.afternoon).toHaveLength(1);
    expect(result.sections.evening).toHaveLength(1);
    expect(result.date).toBe("2026-01-15");
    expect(result.locationId).toBe(LOCATION);
    expect(result.currentUserId).toBe(USER);
  });

  it("looks up each form version once, however many occurrences use it", async () => {
    todayRepository.findOccurrencesWithRecords.mockResolvedValueOnce([
      occurrenceRow({ occurrenceId: "00000000-0000-4000-8000-00000000000a" }),
      occurrenceRow({ occurrenceId: "00000000-0000-4000-8000-00000000000b" }),
    ]);

    await todayService.getToday(
      {} as never,
      LOCATION,
      "2026-01-15",
      USER,
      "Europe/Sofia",
    );

    expect(formRepository.findVersionSummariesByIds).toHaveBeenCalledWith({}, [
      "00000000-0000-4000-8000-0000000000f1",
    ]);
  });

  it("does not query task templates or targets", async () => {
    todayRepository.findOccurrencesWithRecords.mockResolvedValueOnce([]);

    await todayService.getToday(
      {} as never,
      LOCATION,
      "2026-01-15",
      USER,
      "Europe/Sofia",
    );

    expect(todayRepository.findOccurrencesWithRecords).toHaveBeenCalledWith(
      {},
      LOCATION,
      "2026-01-15",
    );
  });
});
