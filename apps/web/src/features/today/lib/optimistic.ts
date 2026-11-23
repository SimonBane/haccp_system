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
  RECORD_KIND,
  RECORD_RESULT,
  RECORD_STATE,
  resolveCorrective,
} from "@haccp/shared";
import { todayItemKey } from "./today-grouping";

/** Cache patches that return the same reference on a no-op so React Query does not notify. */

/** `key` is the Today item key: the occurrence id, or the record id for an on-demand entry. */
export type RecordMutationInput = { key: string } & TaskRecordInput;

function patchItems(
  response: TodayResponse | undefined,
  key: string,
  patch: (task: TodayTaskItem) => TodayTaskItem | null,
): TodayResponse | undefined {
  if (!response) return response;

  let matched = false;
  const patchList = (items: TodayTaskItem[]) =>
    items.flatMap((item) => {
      if (todayItemKey(item) !== key) return [item];
      matched = true;
      const next = patch(item);
      return next === null ? [] : [next];
    });

  const sections = {
    morning: patchList(response.sections.morning),
    afternoon: patchList(response.sections.afternoon),
    evening: patchList(response.sections.evening),
  };
  const entries = patchList(response.onDemand.entries);

  return matched
    ? { ...response, sections, onDemand: { ...response.onDemand, entries } }
    : response;
}

function optimisticUser(currentUserId: string): TodayTaskItem["completedBy"] {
  return { id: currentUserId, firstName: "", lastName: "" };
}

type Judged = Pick<
  TodayTaskItem,
  "result" | "values" | "correctiveAction" | "corrective"
>;

const UNJUDGED: Judged = {
  result: null,
  values: null,
  correctiveAction: null,
  corrective: null,
};

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
  if (evaluated.result !== RECORD_RESULT.FAIL) {
    return { ...UNJUDGED, result: evaluated.result, values: evaluated.values };
  }

  const corrective = resolveCorrective(definition, {
    answerIds: input.correctiveAnswerIds ?? [],
    note: input.correctiveAction ?? "",
  });

  return {
    result: evaluated.result,
    values: evaluated.values,
    correctiveAction: corrective.text,
    corrective: {
      answerIds: corrective.answers.map((answer) => answer.id),
      note: corrective.note,
    },
  };
}

/** Shared by both the create (POST, unrecorded) and update (PUT, edit/reactivate) mutations — both land the item in the same active state. */
export function applyOptimisticRecord(
  response: TodayResponse | undefined,
  input: RecordMutationInput,
  currentUserId: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchItems(response, input.key, (task) => ({
    ...task,
    ...judge(task, input, response?.formVersions ?? {}),
    recordState: RECORD_STATE.ACTIVE,
    status: "completed",
    completedAt: now.toISOString(),
    completedBy: optimisticUser(currentUserId),
  }));
}

/** An undone on-demand entry leaves Today; a scheduled check goes back to waiting. */
export function applyOptimisticVoid(
  response: TodayResponse | undefined,
  key: string,
  now: Date = new Date(),
): TodayResponse | undefined {
  return patchItems(response, key, (task) =>
    task.kind === RECORD_KIND.ON_DEMAND
      ? null
      : {
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
        },
  );
}
