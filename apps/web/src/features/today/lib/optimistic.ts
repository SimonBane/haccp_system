import type {
  FormVersionSummaryMap,
  TaskRecordInput,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import {
  buildAnswerSchema,
  deriveTodayTaskStatusFromOccurrence,
  evaluateAnswers,
  RECORD_RESULT,
  RECORD_STATE,
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

type Judged = Pick<TodayTaskItem, "result" | "values" | "correctiveAction">;

const UNJUDGED: Judged = { result: null, values: null, correctiveAction: null };

/** The server's own judgement, run locally; answers it would reject are left for it to report. */
function judge(
  task: TodayTaskItem,
  input: RecordMutationInput,
  formVersions: FormVersionSummaryMap,
): Judged {
  const definition = formVersions[task.formVersionId]?.definition;
  if (!definition) return UNJUDGED;

  const parsed = buildAnswerSchema(definition).safeParse(input.values);
  if (!parsed.success) return UNJUDGED;

  const evaluated = evaluateAnswers(definition, task.resolvedLimits, parsed.data);
  const correctiveAction = input.correctiveAction?.trim() || null;

  return {
    result: evaluated.result,
    values: evaluated.values,
    correctiveAction:
      evaluated.result === RECORD_RESULT.FAIL ? correctiveAction : null,
  };
}

/** Shared by both the create (POST, unrecorded) and update (PUT, edit/reactivate) mutations — both land the occurrence in the same active state. */
export function applyOptimisticRecord(
  response: TodayResponse | undefined,
  input: RecordMutationInput,
  currentUserId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, input.occurrenceId, (task) => ({
    ...task,
    ...judge(task, input, response?.formVersions ?? {}),
    recordState: RECORD_STATE.ACTIVE,
    status: "completed",
    completedAt: now.toISOString(),
    completedBy: optimisticUser(currentUserId),
  }));
}

export function applyOptimisticVoid(
  response: TodayResponse | undefined,
  occurrenceId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchOccurrence(response, occurrenceId, (task) => ({
    ...task,
    ...UNJUDGED,
    recordState: RECORD_STATE.VOIDED,
    status: deriveTodayTaskStatusFromOccurrence({
      recordState: RECORD_STATE.NONE,
      availableAt: new Date(task.availableAt),
      dueAt: task.dueAt === null ? null : new Date(task.dueAt),
      now,
    }),
    completedAt: null,
    completedBy: null,
  }));
}
