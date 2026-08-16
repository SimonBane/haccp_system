import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import { classifyTemperatureResult, computeTodayTaskStatus } from "@haccp/shared";

/** Cache patches that return the same reference on a no-op so React Query does not notify. */

type OccurrenceTarget = { templateId: string; scheduledTime: string };

function patchOccurrence(
  response: TodayResponse | undefined,
  target: OccurrenceTarget,
  patch: (task: TodayTaskItem) => TodayTaskItem,
): TodayResponse | undefined {
  if (!response) return response;

  let matched = false;
  const patchSection = (items: TodayTaskItem[]) =>
    items.map((item) => {
      if (
        item.templateId !== target.templateId ||
        item.scheduledTime !== target.scheduledTime
      ) {
        return item;
      }
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

export function applyOptimisticCompletion(
  response: TodayResponse | undefined,
  input: CompleteTodayTaskInput,
  currentUserId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, input, (task) => ({
    ...task,
    status: "completed",
    completedAt: now.toISOString(),
    completedBy: optimisticUser(currentUserId),
  }));
}

export function applyOptimisticUncompletion(
  response: TodayResponse | undefined,
  input: CompleteTodayTaskInput,
  timeZone: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, input, (task) => ({
    ...task,
    status: computeTodayTaskStatus({
      date: task.date,
      scheduledTime: task.scheduledTime,
      now,
      completedAt: null,
      timeZone,
    }),
    completedAt: null,
    completedBy: null,
    temperatureReading: null,
  }));
}

export function applyOptimisticTemperature(
  response: TodayResponse | undefined,
  input: CompleteTodayTemperatureTaskInput,
  currentUserId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, input, (task) => {
    const minTempC = task.minTempC ?? task.temperatureReading?.minTempC ?? null;
    const maxTempC = task.maxTempC ?? task.temperatureReading?.maxTempC ?? null;

    // Without a range we cannot classify locally; leave the reading for the server.
    if (minTempC === null || maxTempC === null) {
      return {
        ...task,
        status: "completed",
        completedAt: now.toISOString(),
        completedBy: optimisticUser(currentUserId),
      };
    }

    const correctiveAction = input.correctiveAction?.trim() || null;
    const result = classifyTemperatureResult({
      recordedC: input.recordedC,
      minTempC,
      maxTempC,
    });

    return {
      ...task,
      status: "completed",
      completedAt: now.toISOString(),
      completedBy: optimisticUser(currentUserId),
      temperatureReading: {
        recordedC: input.recordedC,
        result,
        minTempC,
        maxTempC,
        correctiveAction: result === "out_of_range" ? correctiveAction : null,
      },
    };
  });
}
