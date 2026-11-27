import type { FormVersionSummary, RecordItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import { toJournalDocuments } from "../../lib/journal-document";
import { renderJournalPdf, type JournalPdfLabels } from "./journal-pdf";

const VERSION = "00000000-0000-4000-8000-000000000001";
const FORM: FormVersionSummary = {
  id: VERSION,
  formId: "00000000-0000-4000-8000-000000000002",
  formName: "Хладилни камери",
  category: "temperature",
  appliesTo: "per_item",
  onDemand: false,
  version: 2,
  publishedAt: "2026-10-01T08:00:00.000Z",
  definition: {
    correctiveAction: "required_on_fail",
    fields: [
      {
        id: "temperature",
        type: "measurement",
        label: "Температура",
        required: true,
        parameter: "temperature",
        unit: "celsius",
        limits: { min: null, max: 7 },
      },
    ],
  },
};

function reading(entryDate: string, value: number): RecordItem {
  const id = `00000000-0000-4000-8000-0000000${entryDate.replaceAll("-", "").slice(3)}`;
  return {
    id,
    kind: "scheduled",
    occurrenceId: id,
    taskTemplateId: null,
    entryDate,
    entryTime: "08:00",
    availableAt: null,
    dueAt: null,
    title: FORM.formName,
    formVersionId: VERSION,
    category: "temperature",
    targetId: "00000000-0000-4000-8000-000000000003",
    targetName: "Камера 1",
    resolvedLimits: { temperature: { min: null, max: 7 } },
    displayState: "submitted",
    recordState: "submitted",
    timing: "on_time",
    result: value > 7 ? "fail" : "pass",
    record: {
      recordId: id,
      createdAt: `${entryDate}T06:00:00.000Z`,
      createdBy: null,
      recordedAt: `${entryDate}T06:00:00.000Z`,
      recordedBy: { id, firstName: "Борис", lastName: "Оператор" },
      voidedAt: null,
      voidedBy: null,
      values: {
        temperature: {
          type: "measurement",
          value,
          unit: "celsius",
          min: null,
          max: 7,
          fails: value > 7,
        },
      },
      correctiveAction: value > 7 ? "Стоката е преместена" : null,
    },
  } as RecordItem;
}

const CLEANING_VERSION = "00000000-0000-4000-8000-000000000011";
const CLEANING: FormVersionSummary = {
  ...FORM,
  id: CLEANING_VERSION,
  formId: "00000000-0000-4000-8000-000000000012",
  formName: "Почистване",
  category: "cleaning",
  definition: {
    correctiveAction: "optional",
    fields: [
      {
        id: "disinfected",
        type: "choice",
        label: "Дезинфекцирано",
        required: true,
        multiple: false,
        options: [
          { id: "yes", label: "Да", fails: false },
          { id: "no", label: "Не", fails: true },
        ],
      },
    ],
  },
};

function cleaned(suffix: string, targetName: string): RecordItem {
  const id = `00000000-0000-4000-8000-0000000002${suffix}`;
  return {
    ...reading("2026-11-01", 3),
    id,
    occurrenceId: id,
    title: CLEANING.formName,
    formVersionId: CLEANING_VERSION,
    category: "cleaning",
    targetId: id,
    targetName,
    resolvedLimits: {},
    result: "pass",
    record: {
      ...reading("2026-11-01", 3).record!,
      recordId: id,
      values: {
        disinfected: { type: "choice", value: ["yes"], fails: false },
      },
      correctiveAction: null,
    },
  } as RecordItem;
}

const LABELS: JournalPdfLabels = {
  documentTitle: "Дневници",
  brand: "SafeCheck",
  title: "Дневници за проверка",
  position: (index, total) => `Дневник ${index} от ${total}`,
  empty: { title: "Празно", description: "Няма записи" },
  columns: {
    date: "Дата",
    time: "Час",
    item: "Обект",
    task: "Задача",
    result: "Резултат",
    by: "Изпълнил",
    correctiveAction: "Коригиращо действие",
    whatFailed: "Какво",
  },
  status: {
    done: "Изпълнена",
    fail: "Неуспешна",
    missed: "Пропусната",
    open: "Отворена",
    voided: "Анулирана",
  },
  lateSuffix: "закъсняла",
  unknownUser: "Неизвестен",
  entryCount: (count) => `${count} записа`,
  norm: "Норма",
  noAction: "Няма",
  voidedAt: (time) => `${time} анулирана`,
  sheetSummary: (summary) => `${summary.done} от ${summary.total}`,
  limit: (limit) => `граница ${limit}`,
  checkedBy: "Проверил",
  signatureDate: "Дата",
  page: (page, total) => `Стр. ${page} от ${total}`,
  deviationsTitle: "Отклонения",
  deviationsEmpty: "Няма",
};

describe("renderJournalPdf", () => {
  it("starts with the journals, one page each, with Cyrillic and ≤ glyphs", async () => {
    const context = {
      formVersions: { [VERSION]: FORM, [CLEANING_VERSION]: CLEANING },
      format: buildAnswerFormatters({
        locale: "bg",
        symbol: () => "°C",
        yes: "Да",
        no: "Не",
      }),
      limits: () => "≤ 7 °C",
    };

    const pdf = await renderJournalPdf({
      labels: LABELS,
      organization: "Месарница",
      context: "Месарница · 01.11.2026 - 30.11.2026",
      generatedAt: "25.11.2026 10:00",
      documents: toJournalDocuments(
        [
          reading("2026-11-01", 3),
          reading("2026-11-02", 9),
          cleaned("01", "Цех › Под"),
          cleaned("02", "Мивка"),
        ],
        context,
      ),
      deviations: [],
    });

    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(3);
  }, 30_000);

  it("prints a page saying so when the period has no records", async () => {
    const pdf = await renderJournalPdf({
      labels: LABELS,
      organization: "Месарница",
      context: "Месарница · 01.11.2026 - 30.11.2026",
      generatedAt: "25.11.2026 10:00",
      documents: [],
      deviations: null,
    });

    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  }, 30_000);
});
