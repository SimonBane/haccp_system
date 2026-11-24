"use client";

import {
  ITEM_RANGE_PARAMETERS,
  parameterUnit,
  type LimitsIssue,
  type MeasurementParameter,
} from "@haccp/shared";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParameterOption } from "@/features/forms/components/unit-option";
import { sanitizeMeasurementDraft } from "@/features/forms/lib/measurement";
import {
  emptyRange,
  nextFreeParameter,
  type RangeDraft,
} from "@/features/targets/lib/item-limits";

type RangeFieldsProps = {
  idPrefix: string;
  value: RangeDraft[];
  onChange: (next: RangeDraft[]) => void;
  issues: Record<number, LimitsIssue>;
  separator: string;
};

/** The item's own allowed range per measurement; checks on the item are judged by it instead of the form's default. */
export function RangeFields({
  idPrefix,
  value,
  onChange,
  issues,
  separator,
}: RangeFieldsProps) {
  const t = useTranslations("TargetsPage.range");
  const tForms = useTranslations("Forms");
  const freeParameter = nextFreeParameter(value);

  const patch = (index: number, next: Partial<RangeDraft>) =>
    onChange(
      value.map((draft, current) =>
        current === index ? { ...draft, ...next } : draft,
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      {value.map((draft, index) => {
        const issue = issues[index];
        const errorId = `${idPrefix}-range-${index}-error`;
        const unit = parameterUnit(draft.parameter);
        const name = tForms(`parameters.${draft.parameter}`);
        const parameterItems = ITEM_RANGE_PARAMETERS.filter(
          (parameter) =>
            parameter === draft.parameter ||
            !value.some((other) => other.parameter === parameter),
        ).map((parameter) => ({
          value: parameter,
          label: tForms(`parameters.${parameter}`),
        }));
        const bound = (key: "min" | "max", raw: string) =>
          patch(index, {
            [key]: sanitizeMeasurementDraft(raw, separator, unit),
          });

        return (
          <div key={draft.parameter} className="flex flex-col gap-2">
            {index > 0 ? <Separator className="mb-1" /> : null}
            <div className="flex items-center gap-2">
              <Select
                items={parameterItems}
                value={draft.parameter}
                onValueChange={(parameter: unknown) =>
                  patch(index, {
                    ...emptyRange(parameter as MeasurementParameter),
                  })
                }
              >
                <SelectTrigger
                  className="min-w-0 flex-1"
                  aria-label={t("unit")}
                >
                  <SelectValue>
                    {(parameter: MeasurementParameter) => (
                      <ParameterOption parameter={parameter} />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {parameterItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <ParameterOption parameter={item.value} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {value.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="max-md:size-11"
                  aria-label={t("remove", { measurement: name })}
                  onClick={() =>
                    onChange(value.filter((_, current) => current !== index))
                  }
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Input
                inputMode="decimal"
                className="min-w-0 flex-1 tabular-nums"
                placeholder={t("noMin")}
                aria-label={t("min")}
                aria-invalid={Boolean(issue)}
                aria-describedby={issue ? errorId : undefined}
                value={draft.min}
                onChange={(event) => bound("min", event.target.value)}
              />
              <span className="text-sm text-muted-foreground">{t("to")}</span>
              <Input
                inputMode="decimal"
                className="min-w-0 flex-1 tabular-nums"
                placeholder={t("noMax")}
                aria-label={t("max")}
                aria-invalid={Boolean(issue)}
                aria-describedby={issue ? errorId : undefined}
                value={draft.max}
                onChange={(event) => bound("max", event.target.value)}
              />
              <span className="w-8 text-sm text-muted-foreground">
                {tForms(`units.${unit}.symbol`)}
              </span>
            </div>
            {issue ? (
              <FieldError id={errorId}>{t(`issues.${issue}`)}</FieldError>
            ) : null}
          </div>
        );
      })}
      {freeParameter ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start max-md:h-11"
          onClick={() => onChange([...value, emptyRange(freeParameter)])}
        >
          <PlusIcon data-icon="inline-start" />
          {t("addMeasurement")}
        </Button>
      ) : null}
    </div>
  );
}
