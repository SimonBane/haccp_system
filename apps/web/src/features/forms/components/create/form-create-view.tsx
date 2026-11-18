"use client";

import type { StarterForm } from "@haccp/shared";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import {
  emptyBuilderState,
  toBuilderState,
  type BuilderState,
} from "../../lib/form-builder";
import { decimalSeparator } from "../../lib/measurement";
import { FormBuilder } from "../builder/form-builder";
import { CreateStepsHeader, type CreateStep } from "./create-steps";
import { SetupStep } from "./setup-step";
import { TemplateStep } from "./template-step";

type Props = {
  /** A form to copy, which skips choosing a starting point. */
  duplicateOf: StarterForm | null;
};

export function FormCreateView({ duplicateOf }: Props) {
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const [step, setStep] = useState<CreateStep>(duplicateOf ? "setup" : "start");
  const [source, setSource] = useState<StarterForm | null>(duplicateOf);
  const [state, setState] = useState<BuilderState>(() =>
    duplicateOf ? toBuilderState(duplicateOf, separator) : emptyBuilderState(),
  );

  if (step === "fields") {
    return <FormBuilder mode={{ kind: "create", initial: state }} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <CreateStepsHeader current={step} />
      {step === "start" ? (
        <TemplateStep
          onPick={(picked) => {
            setSource(picked);
            setState(picked ? toBuilderState(picked, separator) : emptyBuilderState());
            setStep("setup");
          }}
        />
      ) : (
        <SetupStep
          state={state}
          sourceName={source?.name ?? null}
          onChange={setState}
          onBack={() => setStep("start")}
          onContinue={() => setStep("fields")}
        />
      )}
    </div>
  );
}
