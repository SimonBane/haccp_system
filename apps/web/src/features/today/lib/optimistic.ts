import type { TaskRecordInput, TodayResponse, TodayTaskItem } from "@haccp/shared";
import {
  classifyTemperatureResult,
  deriveTodayTaskStatusFromOccurrence,
  RECORD_KIND,
  RECORD_STATE,
  TEMPERATURE_RESULT,
} from "@haccp/shared";

/** Cache patches that return the same reference on a no-op so React Query does not notify. */

export type RecordMutationInput = { occurrenceId: string } & TaskRecordInput;

function patchOccurrence(
  response: TodayResponse | undefined,
  occurrenceId: string,
  patch: (task: TodayTaskItem) => TodayTaskItem,
): TodayResponse | undefined {
  if (!response) return response;

  let matched = false;
  const patchSection = (items: TodayTaskItem[]) =>
    items.map((item) => {
      if (item.occurrenceId !== occurrenceId) return item;
      matched = true;
      return patch(item);
    });

  const sections = {
    morning: patchSection(response.sections.morning),
    afternoon: patchSection(response.sections.afternoon),
    evening: patchSection(response.sections.evening),
  };

  return matched ? { ...response, sections } : response;
}

function optimisticUser(currentUserId: string): TodayTaskItem["completedBy"] {
  return { id: currentUserId, firstName: "", lastName: "" };
}

function activeCompletionPatch(
  task: TodayTaskItem,
  currentUserId: string,
  now: Date,
  temperatureReading?: TodayTaskItem["temperatureReading"],
): TodayTaskItem {
  return {
    ...task,
    recordState: RECORD_STATE.ACTIVE,
    status: "completed",
    completedAt: now.toISOString(),
    completedBy: optimisticUser(currentUserId),
    temperatureReading: temperatureReading ?? null,
  };
}

/** Shared by both the create (POST, unrecorded) and update (PUT, edit/reactivate) mutations — both land the occurrence in the same active state. */
export function applyOptimisticRecord(
  response: TodayResponse | undefined,
  input: RecordMutationInput,
  currentUserId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, input.occurrenceId, (task) => {
    if (input.kind === RECORD_KIND.ORDINARY) {
      return activeCompletionPatch(task, currentUserId, now);
    }

    const minTempC = task.minTempC ?? task.temperatureReading?.minTempC ?? null;
    const maxTempC = task.maxTempC ?? task.temperatureReading?.maxTempC ?? null;

    // Without a range we cannot classify locally; leave the reading for the server.
    if (minTempC === null || maxTempC === null) {
      return activeCompletionPatch(task, currentUserId, now);
    }

    const correctiveAction = input.correctiveAction?.trim() || null;
    const result = classifyTemperatureResult({
      recordedC: input.recordedC,
      minTempC,
      maxTempC,
    });

    return activeCompletionPatch(task, currentUserId, now, {
      recordedC: input.recordedC,
      result,
      minTempC,
      maxTempC,
      correctiveAction: result === TEMPERATURE_RESULT.OUT_OF_RANGE ? correctiveAction : null,
    });
  });
}

export function applyOptimisticVoid(
  response: TodayResponse | undefined,
  occurrenceId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, occurrenceId, (task) => ({
    ...task,
    recordState: RECORD_STATE.VOIDED,
    status: deriveTodayTaskStatusFromOccurrence({
      recordState: RECORD_STATE.NONE,
      availableAt: new Date(task.availableAt),
      dueAt: task.dueAt === null ? null : new Date(task.dueAt),
      now,
    }),
    completedAt: null,
    completedBy: null,
    temperatureReading: null,
  }));
}
