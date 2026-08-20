import { describe, expect, it, vi } from "vitest";
import { InternalError } from "../../core/errors/app-errors.js";

const todayRepository = vi.hoisted(() => ({
  findOccurrencesWithRecords: vi.fn(),
}));

vi.mock("./today.repository.js", () => ({ todayRepository }));

const { todayService } = await import("./today.service.js");

const LOCATION = "00000000-0000-4000-8000-0000000000l1";
const USER = "00000000-0000-4000-8000-0000000000u1";

function occurrenceRow(overrides: Record<string, unknown> = {}) {
  return {
    occurrenceId: "00000000-0000-4000-8000-00000000000a",
    taskTemplateId: "00000000-0000-4000-8000-00000000000t",
    title: "Wipe counters",
    type: "cleaning",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    scheduledTime: "07:00",
    occurrenceDate: "2026-01-15",
    dueAt: new Date("2026-01-15T07:00:00Z"),
    recordedAt: null,
    recordedByUserId: null,
    recordedByFirstName: null,
    recordedByLastName: null,
    voidedAt: null,
    detailRecordedC: null,
    detailMinTempC: null,
    detailMaxTempC: null,
    detailResult: null,
    detailCorrectiveAction: null,
    ...overrides,
  };
}

describe("todayService.getToday — timezone guard", () => {
  it("rejects a read for an invalid organization timezone", async () => {
    await expect(
      todayService.getToday({} as never, LOCATION, "2026-01-15", USER, "Not/AZone"),
    ).rejects.toBeInstanceOf(InternalError);

    expect(todayRepository.findOccurrencesWithRecords).not.toHaveBeenCalled();
  });
});

describe("todayService.getToday — grouping", () => {
  it("groups occurrences into morning/afternoon/evening by scheduled time", async () => {
    todayRepository.findOccurrencesWithRecords.mockResolvedValueOnce([
      occurrenceRow({ occurrenceId: "00000000-0000-4000-8000-00000000000a", scheduledTime: "07:00" }),
      occurrenceRow({ occurrenceId: "00000000-0000-4000-8000-00000000000b", scheduledTime: "14:00" }),
      occurrenceRow({ occurrenceId: "00000000-0000-4000-8000-00000000000c", scheduledTime: "19:00" }),
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

  it("does not query task templates or equipment", async () => {
    todayRepository.findOccurrencesWithRecords.mockResolvedValueOnce([]);

    await todayService.getToday({} as never, LOCATION, "2026-01-15", USER, "Europe/Sofia");

    expect(todayRepository.findOccurrencesWithRecords).toHaveBeenCalledWith(
      {},
      LOCATION,
      "2026-01-15",
    );
  });
});
