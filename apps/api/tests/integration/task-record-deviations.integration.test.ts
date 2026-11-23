import {
  taskRecordResponseSchema,
  todayResponseSchema,
  zonedDateString,
  type FormDefinition,
} from "@haccp/shared";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  formVersions,
  taskOccurrences,
  taskRecordDeviationAnswers,
  taskRecordDeviations,
} from "../../src/core/db/schema/index.js";
import {
  FRIDGE_CHECK_DEFINITION,
  FRIDGE_FIELD_ID,
  seedOrganization,
  type SeededOrg,
} from "./harness/fixtures.js";
import { apiRequest, asEmployee } from "./harness/request.js";

const WITH_ANSWERS: FormDefinition = {
  ...FRIDGE_CHECK_DEFINITION,
  corrective: {
    answers: [
      { id: "a_moved", label: "Moved product" },
      { id: "a_manager", label: "Notified manager" },
    ],
    multiple: true,
    allowNote: true,
  },
};

describe("Task record deviations", () => {
  let org: SeededOrg;
  let occurrenceId: string;
  let formVersionId: string;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "deviations" });
    const date = zonedDateString(new Date(), org.timeZone);

    const [version] = await db
      .insert(formVersions)
      .values({
        formId: org.forms.fridgeCheck.id,
        version: 2,
        definition: WITH_ANSWERS,
      })
      .returning({ id: formVersions.id });
    formVersionId = version!.id;

    const [occurrence] = await db
      .insert(taskOccurrences)
      .values({
        locationId: org.locations.main.id,
        taskTemplateId: org.templates.temperature.id,
        occurrenceDate: date,
        scheduledTime: "08:00",
        availableAt: new Date(`${date}T00:00:00Z`),
        dueAt: null,
        title: "Fridge check",
        formVersionId,
        targetId: org.targets.fridge.id,
        targetName: "Fridge 1",
        resolvedLimits: { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } },
      })
      .returning({ id: taskOccurrences.id });
    occurrenceId = occurrence!.id;
  });

  async function write(
    method: "POST" | "PUT",
    path: string,
    body: unknown,
  ): Promise<Response> {
    return apiRequest(`/locations/${org.locations.main.id}/today/${path}`, {
      method,
      actor: asEmployee(org),
      body: JSON.stringify(body),
    });
  }

  async function deviationsOf(recordId: string) {
    const rows = await db
      .select()
      .from(taskRecordDeviations)
      .where(eq(taskRecordDeviations.taskRecordId, recordId));
    const answers = await db
      .select({
        deviationId: taskRecordDeviationAnswers.deviationId,
        answerId: taskRecordDeviationAnswers.answerId,
        label: taskRecordDeviationAnswers.label,
      })
      .from(taskRecordDeviationAnswers)
      .orderBy(asc(taskRecordDeviationAnswers.position));
    return { rows, answers };
  }

  it("stores a failed record's deviation, linked to everything a report joins on", async () => {
    const response = await write("POST", `occurrences/${occurrenceId}/record`, {
      values: { [FRIDGE_FIELD_ID]: 12 },
      correctiveAnswerIds: ["a_manager", "a_moved"],
      correctiveAction: "Door was open",
    });

    expect(response.status).toBe(201);
    const record = taskRecordResponseSchema.parse(await response.json());
    expect(record.correctiveAction).toBe(
      "Moved product, Notified manager, Door was open",
    );
    expect(record.corrective).toEqual({
      answerIds: ["a_moved", "a_manager"],
      note: "Door was open",
    });

    const { rows, answers } = await deviationsOf(record.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      taskRecordId: record.id,
      locationId: org.locations.main.id,
      taskTemplateId: org.templates.temperature.id,
      formVersionId,
      targetId: org.targets.fridge.id,
      failedFieldIds: [FRIDGE_FIELD_ID],
      note: "Door was open",
      recordedByUserId: org.employee.userId,
    });
    expect(answers).toEqual([
      { deviationId: rows[0]!.id, answerId: "a_moved", label: "Moved product" },
      {
        deviationId: rows[0]!.id,
        answerId: "a_manager",
        label: "Notified manager",
      },
    ]);
  });

  it("stores no deviation for a passing record", async () => {
    const response = await write("POST", `occurrences/${occurrenceId}/record`, {
      values: { [FRIDGE_FIELD_ID]: 3 },
    });

    const record = taskRecordResponseSchema.parse(await response.json());
    expect((await deviationsOf(record.id)).rows).toEqual([]);
  });

  it("drops the deviation and its answers when the record is corrected to pass", async () => {
    const created = await write("POST", `occurrences/${occurrenceId}/record`, {
      values: { [FRIDGE_FIELD_ID]: 12 },
      correctiveAnswerIds: ["a_moved"],
    });
    const record = taskRecordResponseSchema.parse(await created.json());

    const updated = await write("PUT", `records/${record.id}`, {
      values: { [FRIDGE_FIELD_ID]: 3 },
    });

    expect(updated.status).toBe(200);
    const { rows, answers } = await deviationsOf(record.id);
    expect(rows).toEqual([]);
    expect(answers).toEqual([]);
  });

  it("returns what was chosen on Today so the check can be edited as entered", async () => {
    await write("POST", `occurrences/${occurrenceId}/record`, {
      values: { [FRIDGE_FIELD_ID]: 12 },
      correctiveAnswerIds: ["a_moved"],
    });

    const date = zonedDateString(new Date(), org.timeZone);
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=${date}`,
      { actor: asEmployee(org) },
    );

    expect(response.status).toBe(200);
    const { sections } = todayResponseSchema.parse(await response.json());
    const items = [
      ...sections.morning,
      ...sections.afternoon,
      ...sections.evening,
    ];
    expect(
      items.find((item) => item.occurrenceId === occurrenceId)?.corrective,
    ).toEqual({ answerIds: ["a_moved"], note: null });
  });

  it("rejects an answer the record's form version does not have", async () => {
    const response = await write("POST", `occurrences/${occurrenceId}/record`, {
      values: { [FRIDGE_FIELD_ID]: 12 },
      correctiveAnswerIds: ["a_unknown"],
    });

    expect(response.status).toBe(400);
  });
});
