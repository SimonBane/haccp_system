"use client";

import {
  correctiveSettings,
  type FormDefinition,
  type FormField,
} from "@haccp/shared";
import type { Dispatch, SetStateAction } from "react";
import type { FieldDraft } from "@/features/forms/lib/answer-draft";
import { toggleCorrectiveAnswer } from "@/features/forms/lib/corrective-answers";
import {
  inlineRows,
  isEmptyDraft,
  passingDraft,
  sameAnswer,
  savedDraft,
  toggleOption,
  withValue,
  type InlineDrafts,
} from "../lib/inline-check";
import type { TodayGroup } from "../lib/today-day";

type Params = {
  group: TodayGroup;
  definition: FormDefinition;
  field: FormField;
  separator: string;
  /** Held by the page, so leaving a task with readings typed in does not lose them. */
  drafts: InlineDrafts;
  setDrafts: Dispatch<SetStateAction<InlineDrafts>>;
};

/** Answers stay local until Done, so a slip of the finger never becomes a record. */
export function useInlineDraft({
  group,
  definition,
  field,
  separator,
  drafts,
  setDrafts,
}: Params) {
  const rows = inlineRows(definition, field, group.checks, drafts, separator);
  const checkByKey = new Map(group.checks.map((check) => [check.key, check]));

  function change(key: string, next: FieldDraft) {
    const check = checkByKey.get(key);
    if (!check) return;
    const saved = savedDraft(definition, field, check, separator);
    setDrafts((current) =>
      withValue(current, key, next, sameAnswer(definition, field, next, saved)),
    );
  }

  function choose(key: string, optionId: string) {
    const row = rows.find((item) => item.check.key === key);
    if (row) change(key, toggleOption(field, row.value, optionId));
  }

  const { multiple } = correctiveSettings(definition);

  function toggleAnswer(key: string, answerId: string) {
    setDrafts((current) => {
      const own = current[key];
      if (!own) return current;
      const answerIds = toggleCorrectiveAnswer(own.answerIds, answerId, multiple);
      return { ...current, [key]: { ...own, answerIds } };
    });
  }

  function setNote(key: string, note: string) {
    setDrafts((current) => {
      const own = current[key];
      return own ? { ...current, [key]: { ...own, note } } : current;
    });
  }

  const passing = passingDraft(field);

  function completeAll() {
    if (!passing) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (isEmptyDraft(row.value)) {
          next[row.check.key] = { value: passing, answerIds: [], note: "" };
        }
      }
      return next;
    });
  }

  function forget(keys: readonly string[]) {
    setDrafts((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function reset() {
    forget(group.checks.map((check) => check.key));
  }

  return {
    rows,
    canCompleteAll: passing !== null,
    change,
    choose,
    toggleAnswer,
    setNote,
    completeAll,
    forget,
    reset,
  };
}
