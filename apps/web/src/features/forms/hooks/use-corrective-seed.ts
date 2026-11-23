"use client";

import type { FormCategory } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  CORRECTIVE_SEED_COUNT,
  correctiveSuggestionsFor,
} from "../lib/corrective-suggestions";

/** The answers a new form of this category starts with, in the admin's language. */
export function useCorrectiveSeed() {
  const t = useTranslations("FormsPage.builder.corrective.suggestions");
  return useCallback(
    (category: FormCategory | "") =>
      correctiveSuggestionsFor(category)
        .slice(0, CORRECTIVE_SEED_COUNT)
        .map((key) => t(key)),
    [t],
  );
}
