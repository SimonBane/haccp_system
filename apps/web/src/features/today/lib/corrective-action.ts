import type {
  CorrectiveInput,
  TaskRecordInput,
  TodayTaskItem,
} from "@haccp/shared";

/** Headroom for the answers' labels inside the API's 1000-character field. */
export const NOTES_MAX_LENGTH = 900;

/** A record saved before forms had their own answers only has the text, which returns as the note. */
export function savedCorrective(
  task: Pick<TodayTaskItem, "corrective" | "correctiveAction">,
): CorrectiveInput | null {
  if (task.corrective) {
    return {
      answerIds: task.corrective.answerIds,
      note: task.corrective.note ?? "",
    };
  }
  return task.correctiveAction === null
    ? null
    : { answerIds: [], note: task.correctiveAction };
}

export function correctiveFields(
  corrective: CorrectiveInput | undefined,
): Pick<TaskRecordInput, "correctiveAction" | "correctiveAnswerIds"> {
  if (!corrective) return {};
  return {
    correctiveAction: corrective.note.trim() || undefined,
    correctiveAnswerIds:
      corrective.answerIds.length > 0 ? [...corrective.answerIds] : undefined,
  };
}
