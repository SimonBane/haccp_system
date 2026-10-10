import {
  FIELD_TYPE,
  type FormDefinition,
  type MeasurementUnit,
  type RecordValues,
  type StoredAnswer,
  type StoredMeasurementAnswer,
} from "@haccp/shared";

export type AnswerFormatters = {
  measurement: (value: number, unit: MeasurementUnit) => string;
  /** Dates are always `DD.MM.YYYY`, matching the rest of the records UI. */
  date: (value: string) => string;
  yes: string;
  no: string;
  empty: string;
};

export type AnswerLine = {
  fieldId: string;
  label: string;
  text: string;
  fails: boolean;
};

function answerText(
  answer: StoredAnswer,
  optionLabel: (optionId: string) => string,
  format: AnswerFormatters,
): string {
  switch (answer.type) {
    case FIELD_TYPE.CHECKBOX:
      return answer.value ? format.yes : format.no;
    case FIELD_TYPE.MEASUREMENT:
      return answer.value === null
        ? format.empty
        : format.measurement(answer.value, answer.unit);
    case FIELD_TYPE.CHOICE:
      return answer.value.length === 0
        ? format.empty
        : answer.value.map(optionLabel).join(", ");
    case FIELD_TYPE.TEXT:
      return answer.value.trim() === "" ? format.empty : answer.value;
    case FIELD_TYPE.DATE:
      return answer.value === null ? format.empty : format.date(answer.value);
  }
}

function fails(answer: StoredAnswer): boolean {
  return (
    (answer.type === FIELD_TYPE.MEASUREMENT ||
      answer.type === FIELD_TYPE.CHOICE) &&
    answer.fails
  );
}

/** In the form's field order; without the definition the ids stand in for labels. */
export function describeAnswers(
  definition: FormDefinition | null,
  values: RecordValues,
  format: AnswerFormatters,
): AnswerLine[] {
  if (!definition) {
    return Object.entries(values).map(([fieldId, answer]) => ({
      fieldId,
      label: fieldId,
      text: answerText(answer, (id) => id, format),
      fails: fails(answer),
    }));
  }

  return definition.fields.flatMap((field) => {
    const answer = values[field.id];
    if (answer?.type !== field.type) return [];

    const optionLabel = (optionId: string) =>
      field.type === FIELD_TYPE.CHOICE
        ? (field.options.find((option) => option.id === optionId)?.label ??
          optionId)
        : optionId;

    return [
      {
        fieldId: field.id,
        label: field.label,
        text: answerText(answer, optionLabel, format),
        fails: fails(answer),
      },
    ];
  });
}

/** One line for a grid cell or print row; a single-answer form needs no label. */
export function summarizeAnswers(lines: readonly AnswerLine[]): string {
  if (lines.length === 1) return lines[0]!.text;
  return lines.map((line) => `${line.label}: ${line.text}`).join(" · ");
}

export function primaryMeasurement(
  values: RecordValues | null,
): StoredMeasurementAnswer | null {
  if (!values) return null;

  for (const answer of Object.values(values)) {
    if (answer.type === FIELD_TYPE.MEASUREMENT && answer.value !== null) {
      return answer;
    }
  }

  return null;
}
