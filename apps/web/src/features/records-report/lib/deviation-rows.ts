import {
  FIELD_TYPE,
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  type FormVersionSummaryMap,
  type MeasurementLimits,
  type MeasurementUnit,
  type RecordItem,
} from "@haccp/shared";
import {
  describeAnswers,
  type AnswerFormatters,
} from "@/features/forms/lib/answer-summary";
import { actorName, formatOccurrenceDate } from "@/features/records/lib/format";

export type FailedAnswer = {
  label: string;
  text: string;
  /** The limit in force when the reading was taken, from the record's own snapshot. */
  limit: string | null;
};

export type DeviationRow = {
  id: string;
  date: string;
  time: string;
  title: string;
  targetName: string | null;
  failed: FailedAnswer[];
  correctiveAction: string | null;
  recordedBy: string | null;
};

export type DeviationRowContext = {
  formVersions: FormVersionSummaryMap;
  format: AnswerFormatters;
  limits: (limits: MeasurementLimits, unit: MeasurementUnit) => string | null;
};

/** Failed answers are read from what was stored with the record, never judged again here. */
export function toDeviationRows(
  items: readonly RecordItem[],
  context: DeviationRowContext,
): DeviationRow[] {
  return items.flatMap((item): DeviationRow[] => {
    const record = item.record;
    if (
      !record ||
      item.displayState === RECORD_DISPLAY_STATE.VOIDED ||
      item.result !== RECORD_RESULT.FAIL
    ) {
      return [];
    }

    const failed = describeAnswers(
      context.formVersions[item.formVersionId]?.definition ?? null,
      record.values,
      context.format,
    )
      .filter((line) => line.fails)
      .map((line): FailedAnswer => {
        const answer = record.values[line.fieldId];
        const limits = item.resolvedLimits[line.fieldId];
        return {
          label: line.label,
          text: line.text,
          limit:
            answer?.type === FIELD_TYPE.MEASUREMENT && limits
              ? context.limits(limits, answer.unit)
              : null,
        };
      });

    return [
      {
        id: item.id,
        date: formatOccurrenceDate(item.entryDate),
        time: item.entryTime,
        title: item.title,
        targetName: item.targetName,
        failed,
        correctiveAction: record.correctiveAction,
        recordedBy: actorName(record.recordedBy),
      },
    ];
  });
}
