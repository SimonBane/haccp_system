"use client";

import type { StarterForm } from "@haccp/shared";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { useCorrectiveSeed } from "../../hooks/use-corrective-seed";
import {
  emptyBuilderState,
  seedCorrectiveAnswers,
  toBuilderState,
  type BuilderState,
} from "../../lib/form-builder";
import { decimalSeparator } from "../../lib/measurement";
import { FormBuilder } from "../builder/form-builder";
import { CreateHeader } from "./create-header";
import { TemplateStep } from "./template-step";

type Props = {
  /** A form to copy, which skips choosing a starting point. */
  duplicateOf: StarterForm | null;
};

/** Pick a starting point, then build: name, category and fields are all set in the builder. */
export function FormCreateView({ duplicateOf }: Props) {
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const seed = useCorrectiveSeed();
  // A copy keeps its source's answers, even none; a starter gets its category's usual ones.
  const [initial, setInitial] = useState<BuilderState | null>(() =>
    duplicateOf ? toBuilderState(duplicateOf, separator) : null,
  );

  if (initial) {
    return (
      <FormBuilder
        mode={{
          kind: "create",
          initial,
          // A copy was opened from the forms list, so that is where it goes back to.
          onBack: duplicateOf ? undefined : () => setInitial(null),
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <CreateHeader />
      <TemplateStep
        onPick={(picked) =>
          setInitial(
            picked
              ? seedCorrectiveAnswers(
                  toBuilderState(picked, separator),
                  seed(picked.category),
                )
              : emptyBuilderState(),
          )
        }
      />
    </div>
  );
}
