import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalError, ValidationError } from "../../core/errors/app-errors.js";

const locationRepository = vi.hoisted(() => ({
  findOrganizationContextByLocationId: vi.fn(),
}));
const organizationRepository = vi.hoisted(() => ({
  findAllActive: vi.fn(),
}));
const taskTemplateRepository = vi.hoisted(() => ({
  findActiveWithEquipmentByIds: vi.fn(),
  findActiveIdsByLocationAndEquipment: vi.fn(),
  findActiveIdsByOrganization: vi.fn(),
}));
const taskOccurrenceRepository = vi.hoisted(() => ({
  findByTemplateIds: vi.fn(),
  findRecordedOccurrenceIds: vi.fn(),
  insertMany: vi.fn(),
  deleteByIds: vi.fn(),
}));

vi.mock("../locations/location.repository.js", () => ({ locationRepository }));
vi.mock("../organizations/organization.repository.js", () => ({
  organizationRepository,
}));
vi.mock("../task-templates/task-template.repository.js", () => ({
  taskTemplateRepository,
}));
vi.mock("./task-occurrence.repository.js", () => ({ taskOccurrenceRepository }));

const { taskOccurrenceService } = await import("./task-occurrence.service.js");
type TaskTemplateSourceRow =
  import("../task-templates/task-template.repository.js").TaskTemplateSourceRow;
type TaskOccurrenceRow =
  import("./task-occurrence.repository.js").TaskOccurrenceRow;

const TZ = "Europe/Sofia";
const LOCATION_ID = "00000000-0000-4000-8000-0000000000l1";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000t1";
const ORG_ID = "00000000-0000-4000-8000-0000000000o1";
const EQUIPMENT_ID = "00000000-0000-4000-8000-0000000000e1";
const ALL_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const db = {} as never;

function makeSource(
  overrides: Partial<TaskTemplateSourceRow> = {},
): TaskTemplateSourceRow {
  return {
    id: TEMPLATE_ID,
    locationId: LOCATION_ID,
    title: "Wipe counters",
    type: "cleaning",
    weekdays: ALL_WEEKDAYS,
    scheduledTimes: ["08:00"],
    equipmentId: null,
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: 0,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    ...overrides,
  };
}

function makeExistingRow(
  overrides: Partial<TaskOccurrenceRow> = {},
): TaskOccurrenceRow {
  return {
    id: "00000000-0000-4000-8000-0000000000x1",
    locationId: LOCATION_ID,
    taskTemplateId: TEMPLATE_ID,
    occurrenceDate: "2026-08-19",
    scheduledTime: "08:00",
    // Default template settings (1440 before / 0 after) put availableAt at the
    // start of the Sofia-local day and dueAt at the scheduled instant.
    availableAt: new Date("2026-08-18T21:00:00Z"),
    dueAt: new Date("2026-08-19T05:00:00Z"),
    title: "Wipe counters",
    type: "cleaning",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  } as TaskOccurrenceRow;
}

function defaultRepos(): void {
  taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([]);
  taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([]);
  taskOccurrenceRepository.findRecordedOccurrenceIds.mockResolvedValue(new Set());
  taskOccurrenceRepository.insertMany.mockResolvedValue([]);
  taskOccurrenceRepository.deleteByIds.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  defaultRepos();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reconcileTemplateIds — window and expansion", () => {
  it("materializes exactly the current organization-local date plus the next 13", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T10:00:00Z")); // 13:00 Sofia (summer, UTC+3)

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({ scheduledTimes: ["09:00"] }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
    }[];
    const dates = [...new Set(inserted.map((row) => row.occurrenceDate))].sort();

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-08-19");
    expect(dates[13]).toBe("2026-09-01");
  });

  it("expands only matching weekdays, across every scheduled time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T05:00:00Z")); // 08:00 Sofia, before either slot

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({ weekdays: ["monday"], scheduledTimes: ["09:00", "08:00"] }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
      scheduledTime: string;
    }[];

    // A 14-day window always contains exactly two of any given weekday.
    expect(inserted).toHaveLength(4);
    const mondayDates = [...new Set(inserted.map((row) => row.occurrenceDate))];
    expect(mondayDates).toEqual(["2026-08-24", "2026-08-31"]);
    expect(inserted.map((row) => row.scheduledTime).sort()).toEqual([
      "08:00",
      "08:00",
      "09:00",
      "09:00",
    ]);
  });

  it("excludes a slot that was due before the template existed, but keeps later ones", async () => {
    // Local now: 2026-08-19T13:00 Sofia — after today's 09:00 slot.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T10:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        scheduledTimes: ["09:00"],
        createdAt: new Date("2026-08-19T10:00:00Z"), // created just now, this afternoon
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
    }[];

    expect(inserted.some((row) => row.occurrenceDate === "2026-08-19")).toBe(
      false,
    );
    expect(inserted.some((row) => row.occurrenceDate === "2026-08-20")).toBe(
      true,
    );
  });

  it("restores a legitimate missed occurrence when the template existed before dueAt (delayed job)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T10:00:00Z")); // after today's 09:00 slot, Sofia

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        scheduledTimes: ["09:00"],
        createdAt: new Date("2020-01-01T00:00:00Z"), // long-existing template
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
    }[];

    expect(inserted.some((row) => row.occurrenceDate === "2026-08-19")).toBe(
      true,
    );
  });

  it("resolves a DST-gap wall clock to a real instant instead of throwing or dropping the slot", async () => {
    // 2026-03-29 is a Sunday; Sofia springs forward at 03:00 local that day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T10:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({ weekdays: ["sunday"], scheduledTimes: ["03:30"] }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
      dueAt: Date;
    }[];
    const gapDayRow = inserted.find((row) => row.occurrenceDate === "2026-03-29");

    expect(gapDayRow).toBeDefined();
    expect(Number.isNaN(gapDayRow!.dueAt.getTime())).toBe(false);
    // 03:30 local does not exist; matches wallClockToInstant's own resolution directly.
    expect(gapDayRow!.dueAt.toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });
});

describe("reconcileTemplateIds — completion window derivation", () => {
  it("computes availableAt before the scheduled instant and dueAt after it from the template's window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T04:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ["wednesday"],
        scheduledTimes: ["08:00"],
        completionOpensBeforeMinutes: 30,
        completionDueAfterMinutes: 60,
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
      availableAt: Date;
      dueAt: Date | null;
    }[];
    const row = inserted.find((r) => r.occurrenceDate === "2026-08-19")!;

    // 08:00 Sofia = 05:00Z; 30 minutes before = 04:30Z; 60 minutes after = 06:00Z.
    expect(row.availableAt.toISOString()).toBe("2026-08-19T04:30:00.000Z");
    expect(row.dueAt?.toISOString()).toBe("2026-08-19T06:00:00.000Z");
  });

  it("clamps availableAt to the start of the local day instead of opening on the previous date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T00:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ["wednesday"],
        scheduledTimes: ["08:00"],
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
      availableAt: Date;
    }[];
    const row = inserted.find((r) => r.occurrenceDate === "2026-08-19")!;

    // Start of the Sofia-local day, not 1440 minutes before the 05:00Z scheduled instant.
    expect(row.availableAt.toISOString()).toBe("2026-08-18T21:00:00.000Z");
  });

  it("stores a null dueAt for Never overdue instead of a second boolean flag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T04:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ["wednesday"],
        scheduledTimes: ["08:00"],
        completionDueAfterMinutes: null,
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
      dueAt: Date | null;
    }[];
    const row = inserted.find((r) => r.occurrenceDate === "2026-08-19")!;

    expect(row.dueAt).toBeNull();
  });

  it("uses the scheduled instant, not the later dueAt, as the creation-effective cutoff", async () => {
    // Scheduled instant (05:00Z) has already passed; a 120-minute deadline would push
    // dueAt (07:00Z) to still be ahead of "now" (06:00Z) — the slot must still be excluded.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T06:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ["wednesday"],
        scheduledTimes: ["08:00"],
        completionDueAfterMinutes: 120,
        createdAt: new Date("2026-08-19T06:00:00Z"), // created just now, after 08:00 Sofia
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]![1] as {
      occurrenceDate: string;
    }[];

    expect(inserted.some((row) => row.occurrenceDate === "2026-08-19")).toBe(
      false,
    );
  });
});

describe("reconcileTemplateIds — stored-value comparison and protection", () => {
  it("retains an existing occurrence whose stored values still match", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T04:00:00Z")); // before the 05:00Z (08:00 Sofia) dueAt

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({ weekdays: ["wednesday"], scheduledTimes: ["08:00"] }),
    ]);
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        occurrenceDate: "2026-08-19",
        dueAt: new Date("2026-08-19T05:00:00Z"),
      }),
    ]);

    await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).not.toHaveBeenCalled();
    const inserted = taskOccurrenceRepository.insertMany.mock.calls[0]?.[1] as
      | { occurrenceDate: string }[]
      | undefined;
    expect(
      inserted?.some((row) => row.occurrenceDate === "2026-08-19"),
    ).toBeFalsy();
  });

  it("deletes and recreates an existing occurrence whose stored title changed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T04:00:00Z")); // before the 05:00Z (08:00 Sofia) dueAt

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ["wednesday"],
        scheduledTimes: ["08:00"],
        title: "Wipe counters (renamed)",
      }),
    ]);
    const existingId = "00000000-0000-4000-8000-0000000000x9";
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        id: existingId,
        occurrenceDate: "2026-08-19",
        availableAt: new Date("2026-08-19T04:30:00Z"), // still ahead of "now" — unprotected
        dueAt: new Date("2026-08-19T05:00:00Z"),
        title: "Wipe counters",
      }),
    ]);

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).toHaveBeenCalledWith(db, [
      existingId,
    ]);
    expect(summary.replaced).toBe(1);
    expect(summary.deleted).toBe(0);
  });

  it("never touches a recorded occurrence, even with mismatched values and its dueAt already passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T10:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ALL_WEEKDAYS,
        scheduledTimes: ["08:00"],
        title: "Renamed",
      }),
    ]);
    const existingId = "00000000-0000-4000-8000-0000000000x4";
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        id: existingId,
        occurrenceDate: "2026-08-19",
        dueAt: new Date("2026-08-19T05:00:00Z"), // already past
        title: "Original",
      }),
    ]);
    taskOccurrenceRepository.findRecordedOccurrenceIds.mockResolvedValue(
      new Set([existingId]),
    );

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).not.toHaveBeenCalled();
    expect(summary.replaced).toBe(0);
  });

  it("replaces an unrecorded occurrence even once its availableAt has passed — only a record locks values in", async () => {
    // availableAt (08-18T21:00Z) and dueAt (08-19T05:00Z) are both already past "now", but
    // with no record the stale stored title must still be corrected to match the template.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T10:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ALL_WEEKDAYS,
        scheduledTimes: ["08:00"],
        title: "Renamed",
      }),
    ]);
    const existingId = "00000000-0000-4000-8000-0000000000x5";
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        id: existingId,
        occurrenceDate: "2026-08-19",
        title: "Original",
      }),
    ]);

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).toHaveBeenCalledWith(db, [
      existingId,
    ]);
    expect(summary.replaced).toBe(1);
  });

  it("replaces an unrecorded, mismatched occurrence whether or not its availableAt has passed", async () => {
    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ALL_WEEKDAYS,
        scheduledTimes: ["08:00"],
        title: "Renamed",
      }),
    ]);

    const availableAt = new Date("2026-08-18T21:00:00Z");

    vi.useFakeTimers();
    vi.setSystemTime(new Date(availableAt.getTime() - 1));
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({ occurrenceDate: "2026-08-19", title: "Original" }),
    ]);

    const beforeSummary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });
    expect(beforeSummary.replaced).toBe(1);

    vi.clearAllMocks();
    defaultRepos();
    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ALL_WEEKDAYS,
        scheduledTimes: ["08:00"],
        title: "Renamed",
      }),
    ]);
    vi.setSystemTime(new Date(availableAt.getTime() + 1));
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({ occurrenceDate: "2026-08-19", title: "Original" }),
    ]);

    const afterSummary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });
    expect(afterSummary.replaced).toBe(1);
  });

  it("never touches a protected occurrence with any task_records row, including voided", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T05:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        weekdays: ALL_WEEKDAYS,
        scheduledTimes: ["08:00"],
        title: "Renamed",
      }),
    ]);
    const existingId = "00000000-0000-4000-8000-0000000000x2";
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        id: existingId,
        occurrenceDate: "2026-08-19",
        dueAt: new Date("2026-08-19T09:00:00Z"), // still in the future
        title: "Original",
      }),
    ]);
    taskOccurrenceRepository.findRecordedOccurrenceIds.mockResolvedValue(
      new Set([existingId]),
    );

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).not.toHaveBeenCalled();
    expect(summary.replaced).toBe(0);
  });

  it("deletes an occurrence that is no longer desired (slot dropped or template archived)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T05:00:00Z"));

    // Template is no longer active for this template id, so no sources resolve.
    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([]);
    const existingId = "00000000-0000-4000-8000-0000000000x3";
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        id: existingId,
        availableAt: new Date("2026-08-19T06:00:00Z"), // still ahead of "now" — unprotected
        dueAt: new Date("2026-08-19T09:00:00Z"),
      }),
    ]);

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).toHaveBeenCalledWith(db, [
      existingId,
    ]);
    expect(summary.deleted).toBe(1);
    expect(summary.replaced).toBe(0);
  });

  it("keeps a no-longer-desired occurrence that already opened, even without a record", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T05:00:00Z"));

    // Template is no longer active for this template id, so no sources resolve.
    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([]);
    taskOccurrenceRepository.findByTemplateIds.mockResolvedValue([
      makeExistingRow({
        availableAt: new Date("2026-08-19T04:00:00Z"), // already past "now"
        dueAt: new Date("2026-08-19T09:00:00Z"),
      }),
    ]);

    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TZ,
    });

    expect(taskOccurrenceRepository.deleteByIds).not.toHaveBeenCalled();
    expect(summary.deleted).toBe(0);
  });
});

describe("reconcileTemplateIds — validation", () => {
  it("rejects an invalid organization timezone", async () => {
    await expect(
      taskOccurrenceService.reconcileTemplateIds(db, {
        templateIds: [TEMPLATE_ID],
        timeZone: "Not/AZone",
      }),
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("fails clearly for a temperature template with no resolvable equipment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T05:00:00Z"));

    taskTemplateRepository.findActiveWithEquipmentByIds.mockResolvedValue([
      makeSource({
        type: "temperature",
        equipmentId: EQUIPMENT_ID,
        equipmentName: null, // join failed to resolve — no valid same-location equipment
      }),
    ]);

    await expect(
      taskOccurrenceService.reconcileTemplateIds(db, {
        templateIds: [TEMPLATE_ID],
        timeZone: TZ,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(taskOccurrenceRepository.insertMany).not.toHaveBeenCalled();
  });

  it("returns a zero summary without querying anything for an empty template scope", async () => {
    const summary = await taskOccurrenceService.reconcileTemplateIds(db, {
      templateIds: [],
      timeZone: TZ,
    });

    expect(summary).toEqual({ processed: 0, created: 0, replaced: 0, deleted: 0 });
    expect(taskTemplateRepository.findActiveWithEquipmentByIds).not.toHaveBeenCalled();
  });
});

describe("reconcileTemplate / reconcileEquipment / reconcileOrganization", () => {
  beforeEach(() => {
    locationRepository.findOrganizationContextByLocationId.mockResolvedValue({
      organizationId: ORG_ID,
      timeZone: TZ,
    });
  });

  it("reconcileTemplate resolves the owning organization and scopes to that one template", async () => {
    await taskOccurrenceService.reconcileTemplate(db, LOCATION_ID, TEMPLATE_ID);

    expect(
      locationRepository.findOrganizationContextByLocationId,
    ).toHaveBeenCalledWith(db, LOCATION_ID);
    expect(
      taskTemplateRepository.findActiveWithEquipmentByIds,
    ).toHaveBeenCalledWith(db, [TEMPLATE_ID]);
  });

  it("reconcileTemplate raises when the location has no organization", async () => {
    locationRepository.findOrganizationContextByLocationId.mockResolvedValue(null);

    await expect(
      taskOccurrenceService.reconcileTemplate(db, LOCATION_ID, TEMPLATE_ID),
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("reconcileEquipment scopes to active templates using that equipment", async () => {
    taskTemplateRepository.findActiveIdsByLocationAndEquipment.mockResolvedValue([
      TEMPLATE_ID,
    ]);

    await taskOccurrenceService.reconcileEquipment(
      db,
      LOCATION_ID,
      EQUIPMENT_ID,
    );

    expect(
      taskTemplateRepository.findActiveIdsByLocationAndEquipment,
    ).toHaveBeenCalledWith(db, LOCATION_ID, EQUIPMENT_ID);
    expect(
      taskTemplateRepository.findActiveWithEquipmentByIds,
    ).toHaveBeenCalledWith(db, [TEMPLATE_ID]);
  });

  it("reconcileOrganization scopes to every active template in the organization", async () => {
    taskTemplateRepository.findActiveIdsByOrganization.mockResolvedValue([
      TEMPLATE_ID,
    ]);

    await taskOccurrenceService.reconcileOrganization(db, ORG_ID, TZ);

    expect(taskTemplateRepository.findActiveIdsByOrganization).toHaveBeenCalledWith(
      db,
      ORG_ID,
    );
    expect(
      taskTemplateRepository.findActiveWithEquipmentByIds,
    ).toHaveBeenCalledWith(db, [TEMPLATE_ID]);
  });
});

describe("reconcileAllOrganizations", () => {
  it("aggregates per-organization summaries and isolates a failing organization", async () => {
    organizationRepository.findAllActive.mockResolvedValue([
      { id: "org-a", timeZone: TZ },
      { id: "org-b", timeZone: TZ },
    ]);

    const reconcileOrgSpy = vi
      .spyOn(taskOccurrenceService, "reconcileOrganization")
      .mockResolvedValueOnce({ processed: 2, created: 1, replaced: 0, deleted: 0 })
      .mockRejectedValueOnce(new Error("boom"));

    const fakeDb = {
      transaction: (fn: (tx: unknown) => unknown) => fn(fakeDb),
    } as never;

    const result = await taskOccurrenceService.reconcileAllOrganizations(fakeDb);

    expect(result).toEqual({
      organizations: 2,
      processed: 2,
      created: 1,
      replaced: 0,
      deleted: 0,
    });
    expect(reconcileOrgSpy).toHaveBeenCalledTimes(2);

    reconcileOrgSpy.mockRestore();
  });
});
