"use client";

import {
  TASK_TEMPLATE_MAX_TARGETS,
  type LimitsIssue,
  type MeasurementField,
  type TargetResponse,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  overrideIssueKey,
  type OverrideDraft,
  type TargetSelection,
} from "@/features/task-templates/lib/form-helpers";
import { Link } from "@/i18n/navigation";

type Props = {
  id: string;
  targets: TargetResponse[];
  /** The selected form's measurement fields; empty until a form is chosen. */
  measurementFields: MeasurementField[];
  value: TargetSelection[];
  onChange: (next: TargetSelection[]) => void;
  issues: Record<string, LimitsIssue>;
};

function groupByType(targets: TargetResponse[]): [string, TargetResponse[]][] {
  const groups = new Map<string, TargetResponse[]>();
  for (const target of targets) {
    const list = groups.get(target.targetTypeName) ?? [];
    list.push(target);
    groups.set(target.targetTypeName, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function sanitizeLimitText(raw: string): string {
  return raw.replace(/[−–—]/g, "-").replace(/[^0-9\-.,]/g, "");
}

export function TargetPicker({
  id,
  targets,
  measurementFields,
  value,
  onChange,
  issues,
}: Props) {
  const t = useTranslations("TasksPage.targets");
  const format = useAnswerFormat();
  const selected = new Map(
    value.map((selection) => [selection.targetId, selection]),
  );
  const isFull = value.length >= TASK_TEMPLATE_MAX_TARGETS;

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-4 py-3">
        <p className="text-sm text-muted-foreground">{t("none")}</p>
        <Button
          variant="link"
          className="h-auto p-0"
          render={<Link href="/dashboard/targets" />}
        >
          {t("manage")}
        </Button>
      </div>
    );
  }

  function toggle(targetId: string, checked: boolean) {
    onChange(
      checked
        ? [...value, { targetId, overrides: {} }]
        : value.filter((selection) => selection.targetId !== targetId),
    );
  }

  function patchOverride(
    targetId: string,
    fieldId: string,
    patch: Partial<OverrideDraft>,
    defaults: OverrideDraft,
  ) {
    onChange(
      value.map((selection) =>
        selection.targetId === targetId
          ? {
              ...selection,
              overrides: {
                ...selection.overrides,
                [fieldId]: {
                  ...(selection.overrides[fieldId] ?? defaults),
                  ...patch,
                },
              },
            }
          : selection,
      ),
    );
  }

  return (
    <div className="flex max-h-96 flex-col overflow-y-auto rounded-lg border">
      {groupByType(targets).map(([typeName, group]) => (
        <div key={typeName} className="border-b last:border-b-0">
          <p className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {typeName}
          </p>
          <ul className="flex flex-col">
            {group.map((target) => {
              const selection = selected.get(target.id);
              const checkboxId = `${id}-${target.id}`;
              return (
                <li key={target.id} className="flex flex-col gap-3 px-3 py-2.5">
                  <FieldLabel
                    htmlFor={checkboxId}
                    className="w-full items-center gap-3 font-normal"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={Boolean(selection)}
                      disabled={!selection && isFull}
                      onCheckedChange={(checked) =>
                        toggle(target.id, checked === true)
                      }
                    />
                    <span className="flex-1">{target.name}</span>
                  </FieldLabel>

                  {selection
                    ? measurementFields.map((field) => {
                        const defaults: OverrideDraft = {
                          enabled: false,
                          min:
                            field.limits.min === null
                              ? ""
                              : String(field.limits.min),
                          max:
                            field.limits.max === null
                              ? ""
                              : String(field.limits.max),
                        };
                        const draft = selection.overrides[field.id] ?? defaults;
                        const issue =
                          issues[overrideIssueKey(target.id, field.id)];
                        const overrideId = `${checkboxId}-${field.id}`;
                        const symbol = format.symbol(field.unit);
                        const defaultText =
                          format.limits(field.limits, field.unit) ??
                          t("noLimits");

                        return (
                          <div
                            key={field.id}
                            className="ml-7 flex flex-col gap-2 rounded-md bg-muted/30 px-3 py-2"
                          >
                            <Field orientation="horizontal">
                              <Switch
                                id={overrideId}
                                checked={draft.enabled}
                                onCheckedChange={(enabled) =>
                                  patchOverride(
                                    target.id,
                                    field.id,
                                    { enabled },
                                    defaults,
                                  )
                                }
                              />
                              <FieldLabel
                                htmlFor={overrideId}
                                className="flex-col items-start gap-0 font-normal"
                              >
                                <span>
                                  {t("customLimits", { field: field.label })}
                                </span>
                                {draft.enabled ? null : (
                                  <span className="text-xs text-muted-foreground">
                                    {t("formDefault", { limits: defaultText })}
                                  </span>
                                )}
                              </FieldLabel>
                            </Field>
                            {draft.enabled ? (
                              <Field data-invalid={Boolean(issue)}>
                                <div className="flex items-center gap-2">
                                  {(["min", "max"] as const).map(
                                    (bound, index) => (
                                      <div
                                        key={bound}
                                        className="flex flex-1 items-center gap-2"
                                      >
                                        {index === 1 ? (
                                          <span className="text-sm text-muted-foreground">
                                            {t("to")}
                                          </span>
                                        ) : null}
                                        <InputGroup className="flex-1">
                                          <InputGroupInput
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            aria-label={t(bound, {
                                              field: field.label,
                                              target: target.name,
                                            })}
                                            aria-invalid={Boolean(issue)}
                                            placeholder={t("noLimit")}
                                            className="tabular-nums"
                                            value={draft[bound]}
                                            onChange={(event) =>
                                              patchOverride(
                                                target.id,
                                                field.id,
                                                {
                                                  [bound]: sanitizeLimitText(
                                                    event.target.value,
                                                  ),
                                                },
                                                defaults,
                                              )
                                            }
                                          />
                                          <InputGroupAddon align="inline-end">
                                            <InputGroupText>
                                              {symbol}
                                            </InputGroupText>
                                          </InputGroupAddon>
                                        </InputGroup>
                                      </div>
                                    ),
                                  )}
                                </div>
                                {issue ? (
                                  <FieldError
                                    errors={[{ message: t(`issues.${issue}`) }]}
                                  />
                                ) : null}
                              </Field>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
