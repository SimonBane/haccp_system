"use client";

import {
  TARGET_NAME_MAX_LENGTH,
  API_ERROR_CODE,
  TARGET_KIND,
  TARGET_KIND_VALUES,
  isTargetNameTaken,
  type LimitsIssue,
  type TargetInput,
  type TargetKind,
  type TargetResponse,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { GaugeIcon, InfoIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Controller, useForm, useFormState, useWatch } from "react-hook-form";
import { z } from "zod";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { decimalSeparator } from "@/features/forms/lib/measurement";
import { KindPicker } from "@/features/targets/components/kind-picker";
import { RangeFields } from "@/features/targets/components/range-fields";
import {
  limitsFromRanges,
  rangesFromLimits,
  storedRanges,
  type RangeDraft,
} from "@/features/targets/lib/item-limits";
import {
  areaWithDescendants,
  buildTargetTree,
  flattenAreas,
} from "@/features/targets/lib/target-tree";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { cn } from "@/lib/utils";

const TARGETS_FORM_ID = "targets-form";
const NO_AREA = "none";
const DEPTH_INDENT = ["", "pl-6", "pl-9", "pl-12"];

type TargetsFormValues = {
  name: string;
  kind: TargetKind;
  parentId: string;
  rangesOn: boolean;
  ranges: RangeDraft[];
  copyContents: boolean;
};

export type TargetsFormDefaults = {
  kind: TargetKind;
  parentId: string | null;
  /** Opened from an area's row: the area is fixed and a component can be picked. */
  inArea: boolean;
};

type TargetsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: TargetResponse | null;
  duplicateSource?: TargetResponse | null;
  suggestedDuplicateName?: string;
  /** Kind and area a new item starts with; a component's area comes from the row it was added on. */
  defaults: TargetsFormDefaults;
  items: TargetResponse[];
  /** `copyContents`: a duplicated area brings everything inside it along. */
  onSubmit: (values: TargetInput, copyContents: boolean) => Promise<void>;
};

export function TargetsForm({
  open,
  onOpenChange,
  target,
  duplicateSource,
  suggestedDuplicateName,
  defaults,
  items,
  onSubmit,
}: TargetsFormProps) {
  const t = useTranslations("TargetsPage");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const showApiError = useApiErrorToast();
  // Tied to the values a session opened with, so reopening never shows stale issues.
  const [rangeCheck, setRangeCheck] = useState<{
    session: TargetsFormValues | null;
    issues: Record<number, LimitsIssue>;
  }>({ session: null, issues: {} });
  const kindLabelId = useId();
  const rangeSwitchId = useId();
  const isEditing = Boolean(target);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;
  const parentLocked = !isEditing && !isDuplicating && defaults.inArea;
  // A component needs an area, so it is offered only where one is already set.
  const kinds: readonly TargetKind[] =
    parentLocked ||
    (target ?? duplicateSource)?.kind === TARGET_KIND.COMPONENT
      ? TARGET_KIND_VALUES
      : [TARGET_KIND.EQUIPMENT, TARGET_KIND.AREA];

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(
            TARGET_NAME_MAX_LENGTH,
            t("validation.nameMaxLength", { max: TARGET_NAME_MAX_LENGTH }),
          ),
        kind: z.enum(TARGET_KIND_VALUES),
        parentId: z.string(),
        rangesOn: z.boolean(),
        copyContents: z.boolean(),
        ranges: z.array(
          z.object({
            parameter: z.custom<RangeDraft["parameter"]>(),
            min: z.string(),
            max: z.string(),
          }),
        ),
      })
      .refine(
        (values) =>
          values.kind !== TARGET_KIND.COMPONENT || values.parentId !== NO_AREA,
        { message: t("form.parentRequired"), path: ["parentId"] },
      ),
    [t],
  );

  const defaultValues = useMemo<TargetsFormValues>(() => {
    const source = target ?? duplicateSource;
    if (source) {
      return {
        name: target ? target.name : (suggestedDuplicateName ?? source.name),
        kind: source.kind,
        parentId: source.parentId ?? NO_AREA,
        rangesOn: storedRanges(source.limits).length > 0,
        ranges: rangesFromLimits(source.limits, separator),
        copyContents: true,
      };
    }
    return {
      name: "",
      kind: defaults.kind,
      parentId: defaults.parentId ?? NO_AREA,
      rangesOn: false,
      ranges: rangesFromLimits({}, separator),
      copyContents: false,
    };
  }, [target, duplicateSource, suggestedDuplicateName, defaults, separator]);

  const zodErrorMap = useZodErrorMap();

  const form = useForm<TargetsFormValues>({
    resolver: zodResolver(schema, { error: zodErrorMap }),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const rangeIssues =
    rangeCheck.session === defaultValues ? rangeCheck.issues : {};
  const setRangeIssues = (issues: Record<number, LimitsIssue>) =>
    setRangeCheck({ session: defaultValues, issues });

  const kind = useWatch({ control: form.control, name: "kind" });
  const rangesOn = useWatch({ control: form.control, name: "rangesOn" });
  const isComponent = kind === TARGET_KIND.COMPONENT;
  const contentsCount = useMemo(
    () =>
      isDuplicating && duplicateSource
        ? areaWithDescendants(items, duplicateSource.id).size - 1
        : 0,
    [isDuplicating, duplicateSource, items],
  );
  const { isSubmitting, isDirty } = useFormState({ control: form.control });

  const areaItems = useMemo(() => {
    // An area cannot move into itself or anything nested inside it.
    const blocked =
      target?.kind === TARGET_KIND.AREA
        ? areaWithDescendants(items, target.id)
        : new Set<string>();
    const areas = flattenAreas(buildTargetTree(items)).filter(
      ({ area }) => !blocked.has(area.id),
    );
    return [
      // A component is part of a room, so it cannot stand alone.
      ...(kind === TARGET_KIND.COMPONENT
        ? []
        : [{ value: NO_AREA, label: t("form.parentNone"), depth: 0 }]),
      ...areas.map(({ area, depth }) => ({
        value: area.id,
        label: area.name,
        depth,
      })),
    ];
  }, [items, target, kind, t]);

  async function handleValidSubmit(values: TargetsFormValues) {
    if (isEditing && !isDirty) {
      onOpenChange(false);
      return;
    }

    const { limits, issues } =
      values.kind === TARGET_KIND.COMPONENT || !values.rangesOn
        ? { limits: {}, issues: {} }
        : limitsFromRanges(values.ranges);
    setRangeIssues(issues);
    if (Object.keys(issues).length > 0) return;

    const input: TargetInput = {
      name: values.name.trim(),
      kind: values.kind,
      parentId: values.parentId === NO_AREA ? null : values.parentId,
      limits,
    };
    const takenMessage = t(
      input.kind === TARGET_KIND.COMPONENT ? "nameTakenComponent" : "nameTaken",
    );
    if (isTargetNameTaken(items, { ...input, id: target?.id })) {
      form.setError("name", { message: takenMessage });
      return;
    }

    try {
      await onSubmit(
        input,
        contentsCount > 0 &&
          values.kind === TARGET_KIND.AREA &&
          values.copyContents,
      );
      onOpenChange(false);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.TARGET_NAME_EXISTS
      ) {
        form.setError("name", { message: takenMessage });
        return;
      }
      showApiError(error);
    }
  }

  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;
  const mode = isEditing ? "edit" : isDuplicating ? "duplicate" : "add";

  return (
    <ResponsiveFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(`form.${mode}Title`)}
      description={t(`form.${mode}Description`)}
      closeLabel={t("cancel")}
      initialFocus={isEditing || isDuplicating ? undefined : false}
      footer={
        <div className="flex justify-end">
          <Button
            type="submit"
            form={TARGETS_FORM_ID}
            className="max-md:h-11 max-md:w-full"
            isLoading={isSubmitting}
            disabled={isEditing && !isDirty}
          >
            <SubmitIcon data-icon="inline-start" />
            {isEditing ? t("save") : t("add")}
          </Button>
        </div>
      }
    >
      <form
        id={TARGETS_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
      >
        <FieldGroup>
          <Controller
            name="kind"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldTitle id={kindLabelId}>{t("form.kindLabel")}</FieldTitle>
                <KindPicker
                  labelledBy={kindLabelId}
                  kinds={kinds}
                  value={field.value}
                  onChange={field.onChange}
                />
              </Field>
            )}
          />

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-baseline justify-between gap-3">
                  <FieldLabel
                    htmlFor={`${TARGETS_FORM_ID}-name`}
                    className={REQUIRED_LABEL_CLASS}
                  >
                    {t("nameLabel")}
                  </FieldLabel>
                  <CharacterCount value={field.value} max={TARGET_NAME_MAX_LENGTH} />
                </div>
                <Input
                  {...field}
                  id={`${TARGETS_FORM_ID}-name`}
                  maxLength={TARGET_NAME_MAX_LENGTH}
                  aria-invalid={fieldState.invalid}
                  placeholder={t(`form.namePlaceholder.${kind}`)}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />

          <Controller
            name="parentId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} data-disabled={parentLocked}>
                <FieldLabel
                  htmlFor={`${TARGETS_FORM_ID}-parent`}
                  className={isComponent ? REQUIRED_LABEL_CLASS : undefined}
                >
                  {t("form.parentLabel")}
                </FieldLabel>
                <Select
                  items={areaItems}
                  value={
                    isComponent && field.value === NO_AREA ? null : field.value
                  }
                  disabled={parentLocked}
                  onValueChange={(value: unknown) =>
                    field.onChange(value as string)
                  }
                >
                  <SelectTrigger
                    id={`${TARGETS_FORM_ID}-parent`}
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder={t("form.parentRequired")} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {areaItems.map((item) => (
                        <SelectItem
                          key={item.value}
                          value={item.value}
                          className={DEPTH_INDENT[Math.min(item.depth, 3)]}
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />

          {contentsCount > 0 && kind === TARGET_KIND.AREA ? (
            <Controller
              name="copyContents"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel
                    htmlFor={`${TARGETS_FORM_ID}-copy-contents`}
                    className="w-full items-center gap-3 rounded-lg border px-3 py-3"
                  >
                    <Checkbox
                      id={`${TARGETS_FORM_ID}-copy-contents`}
                      checked={field.value}
                      onCheckedChange={(next) => field.onChange(next === true)}
                    />
                    <span className="flex-1">
                      {t("form.copyContents", { count: contentsCount })}
                    </span>
                  </FieldLabel>
                </Field>
              )}
            />
          ) : null}

          {isComponent ? null : (
            <section
              aria-labelledby={`${rangeSwitchId}-label`}
              className={cn(
                "flex flex-col gap-4 rounded-xl p-4 transition-shadow",
                rangesOn
                  ? "bg-card shadow-xs ring-1 ring-foreground/10"
                  : "border border-dashed border-foreground/25",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <GaugeIcon className="size-4" aria-hidden />
                </span>
                <FieldLabel
                  id={`${rangeSwitchId}-label`}
                  htmlFor={rangeSwitchId}
                  className="flex-1 font-medium"
                >
                  {t("range.label")}
                </FieldLabel>
                <Controller
                  name="rangesOn"
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      id={rangeSwitchId}
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setRangeIssues({});
                      }}
                    />
                  )}
                />
              </div>

              {rangesOn ? (
                <div className="flex flex-col gap-4 border-t pt-4">
                  <Controller
                    name="ranges"
                    control={form.control}
                    render={({ field }) => (
                      <RangeFields
                        idPrefix={TARGETS_FORM_ID}
                        value={field.value}
                        onChange={(next) => {
                          field.onChange(next);
                          setRangeIssues({});
                        }}
                        issues={rangeIssues}
                        separator={separator}
                      />
                    )}
                  />
                  {isEditing && target && target.taskCount > 0 ? (
                    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                      <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                      {t("range.impact")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </FieldGroup>
      </form>
    </ResponsiveFormSheet>
  );
}
