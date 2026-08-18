import { describe, expect, it, vi } from "vitest";
import { InternalError } from "../../core/errors/app-errors.js";

const taskTemplateRepository = vi.hoisted(() => ({
  findManyWithEquipmentByLocationAndWeekday: vi.fn(),
}));
const todayRepository = vi.hoisted(() => ({
  findCompletionsWithTemperatureLogs: vi.fn(),
  buildCompletionMap: vi.fn(() => new Map()),
}));

vi.mock("../task-templates/task-template.repository.js", () => ({
  taskTemplateRepository,
}));
vi.mock("./today.repository.js", () => ({ todayRepository }));

const { todayService } = await import("./today.service.js");

describe("todayService.getToday — timezone guard", () => {
  it("rejects a read for an invalid organization timezone", async () => {
    await expect(
      todayService.getToday(
        {} as never,
        "00000000-0000-4000-8000-0000000000l1",
        "2026-01-15",
        "00000000-0000-4000-8000-0000000000u1",
        "Not/AZone",
      ),
    ).rejects.toBeInstanceOf(InternalError);

    expect(
      taskTemplateRepository.findManyWithEquipmentByLocationAndWeekday,
    ).not.toHaveBeenCalled();
  });
});
