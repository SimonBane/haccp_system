"use client";

import {
  TASK_TEMPLATE_COMPLETION_MINUTES_MAX,
  TASK_TEMPLATE_COMPLETION_MINUTES_MIN,
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  getMeasurementFields,
  scheduledTimeSchema,
  taskTemplateWeekdaySchema,
  type FormResponse,
  type LimitsIssue,
  type TargetResponse,
  type TaskTemplateFieldsInput,
  type TaskTemplateResponse,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useController,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
} from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { cn } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildDefaultCompletionWindow,
  buildDefaultTargets,
  buildDefaultTimeRows,
  buildDefaultWeekdays,
  findDuplicateScheduledTimeIndices,
  getNextDefaultScheduledTime,
  getScheduledTimeRowsErrorMessage,
  hasTaskChanges,
  toTargetInputs,
  type CompletionWindowValues,
  type ScheduledTimeRowValue,
  type TargetSelection,
} from "@/features/task-templates/lib/form-helpers";
import {
  COMPLETION_DUE_PRESET_MINUTES,
  COMPLETION_OPENS_PRESET_MINUTES,
  CUSTOM_MINUTES_INITIAL_VALUE,
  resolveDuePreset,
  resolveOpensPreset,
  type CompletionDuePreset,
  type CompletionOpensPreset,
} from "@/features/task-templates/lib/completion-window";
import { ScheduledTimeRow } from "@/features/task-templates/components/scheduled-time-row";
import { TargetPicker } from "@/features/task-templates/components/target-picker";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { decimalSeparator } from "@/features/forms/lib/measurement";
import { Link } from "@/i18n/navigation";
import { WeekdayToggleStrip } from "@/features/task-templates/components/weekday-toggle-strip";
import { CompletionWindowFields } from "@/features/task-templates/components/completion-window-fields";

const TASK_TEMPLATES_FORM_ID = "task-templates-form";

type TaskTemplatesFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskTemplateResponse | null;
  duplicateSource?: TaskTemplateResponse | null;
  suggestedDuplicateTitle?: string;
  forms: FormResponse[];
  targets: TargetResponse[];
  onSubmit: (values: TaskTemplateFieldsInput) => Promise<void>;
};

export function TaskTemplatesForm({
  open,
  onOpenChange,
  task,
  duplicateSource,
  suggestedDuplicateTitle,
  forms,
  targets,
  onSubmit,
}: TaskTemplatesFormProps) {
  const t = useTranslations("TasksPage");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const showApiError = useApiErrorToast();
  const isEditing = Boolean(task);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;

  const tasksFormSchema = useMemo(() => {
    return z
      .object({
        title: z
          .string()
          .trim()
          .min(1, t("validation.titleRequired"))
          .max(200, t("validation.titleMaxLength")),
        formId: z.string().min(1, t("validation.formRequired")),
        weekdays: z
          .array(taskTemplateWeekdaySchema)
          .min(1, t("validation.weekdaysRequired")),
        scheduledTimeRows: z
          .array(
            z.object({
              time: z.string().superRefine((value, ctx) => {
                if (value === "") {
                  ctx.addIssue({
                    code: "custom",
                    message: t("validation.timeRequired"),
                  });
                  return;
                }

                const result = scheduledTimeSchema.safeParse(value);
                if (!result.success) {
                  ctx.addIssue({
                    code: "custom",
                    message: t("validation.timeInvalid"),
                  });
                }
              }),
            }),
          )
          .min(1, t("validation.timesRequired"))
          .max(TASK_TEMPLATE_MAX_SCHEDULED_TIMES, t("validation.timesMax")),
        targets: z.array(
          z.object({
            targetId: z.string(),
            overrides: z.record(
              z.string(),
              z.object({
                enabled: z.boolean(),
                min: z.string(),
                max: z.string(),
              }),
            ),
          }),
        ),
        completionOpensBeforeMinutes: z.string(),
        completionDueAfterMinutes: z.string(),
        neverOverdue: z.boolean(),
      })
      .superRefine((data, ctx) => {
        validateMinutesField(
          data.completionOpensBeforeMinutes,
          ctx,
          "completionOpensBeforeMinutes",
          t("validation.completionAvailableRequired"),
        );

        if (!data.neverOverdue) {
          validateMinutesField(
            data.completionDueAfterMinutes,
            ctx,
            "completionDueAfterMinutes",
            t("validation.completionDeadlineRequired"),
          );
        }
      });

    function validateMinutesField(
      value: string,
      ctx: z.core.$RefinementCtx,
      path: string,
      requiredMessage: string,
    ) {
      if (value === "") {
        ctx.addIssue({
          code: "custom",
          message: requiredMessage,
          path: [path],
        });
        return;
      }

      if (!/^\d+$/.test(value)) {
        ctx.addIssue({
          code: "custom",
          message: t("validation.completionMinutesInteger"),
          path: [path],
        });
        return;
      }

      const parsed = Number(value);
      if (
        parsed < TASK_TEMPLATE_COMPLETION_MINUTES_MIN ||
        parsed > TASK_TEMPLATE_COMPLETION_MINUTES_MAX
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("validation.completionMinutesRange"),
          path: [path],
        });
      }
    }
  }, [t]);

  type TaskTemplatesFormValues = {
    title: string;
    formId: string;
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    targets: TargetSelection[];
  } & CompletionWindowValues;

  const defaultValues = useMemo((): TaskTemplatesFormValues => {
    const source = task ?? duplicateSource;

    return {
      title:
        task?.title ??
        (duplicateSource
          ? (suggestedDuplicateTitle ?? duplicateSource.title)
          : ""),
      formId: source?.formId ?? "",
      weekdays: buildDefaultWeekdays(task, duplicateSource),
      scheduledTimeRows: buildDefaultTimeRows(task, duplicateSource),
      targets: buildDefaultTargets(task, duplicateSource, separator),
      ...buildDefaultCompletionWindow(task, duplicateSource),
    };
  }, [task, duplicateSource, suggestedDuplicateTitle, separator]);

  const zodErrorMap = useZodErrorMap();

  const form = useForm<TaskTemplatesFormValues>({
    resolver: zodResolver(tasksFormSchema, { error: zodErrorMap }),
    defaultValues,
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "scheduledTimeRows",
  });

  // One object so reset-on-open is a single update (separate useStates in an effect killed the
  // sheet slide-in) — covers the add-time autofocus target and the two completion-window preset
  // selections, none of which live in RHF state.
  const [formUi, setFormUi] = useState<{
    autoFocusTimeIndex: number | null;
    opensPreset: CompletionOpensPreset | null;
    duePreset: CompletionDuePreset | null;
    overrideIssues: Record<string, LimitsIssue>;
  }>(() => ({
    autoFocusTimeIndex: null,
    overrideIssues: {},
    opensPreset: resolveOpensPreset(defaultValues.completionOpensBeforeMinutes),
    duePreset: resolveDuePreset(
      defaultValues.completionDueAfterMinutes,
      defaultValues.neverOverdue,
    ),
  }));
  const { autoFocusTimeIndex, opensPreset, duePreset, overrideIssues } = formUi;

  const setAutoFocusTimeIndex = (next: number | null) =>
    setFormUi((previous) => ({ ...previous, autoFocusTimeIndex: next }));
  const titleRef = useRef<HTMLInputElement | null>(null);

  // Reset on open via the prop: the parent never calls `onOpenChange`. Adjust UI during render; `form.reset` stays in an effect.
  const [openedValues, setOpenedValues] =
    useState<TaskTemplatesFormValues | null>(null);

  // Null while closed so reopening the same record is a fresh open (`defaultValues` identity would skip the reset).
  const openedTarget = open ? defaultValues : null;

  if (openedValues !== openedTarget) {
    setOpenedValues(openedTarget);
    if (openedTarget) {
      setFormUi({
        autoFocusTimeIndex: null,
        overrideIssues: {},
        opensPreset: resolveOpensPreset(
          openedTarget.completionOpensBeforeMinutes,
        ),
        duePreset: resolveDuePreset(
          openedTarget.completionDueAfterMinutes,
          openedTarget.neverOverdue,
        ),
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const weekdayShortLabels: Record<TaskTemplateWeekday, string> = {
    monday: t("weekdaysShort.monday"),
    tuesday: t("weekdaysShort.tuesday"),
    wednesday: t("weekdaysShort.wednesday"),
    thursday: t("weekdaysShort.thursday"),
    friday: t("weekdaysShort.friday"),
    saturday: t("weekdaysShort.saturday"),
    sunday: t("weekdaysShort.sunday"),
  };

  const weekdayFullLabels: Record<TaskTemplateWeekday, string> = {
    monday: t("weekdaysFull.monday"),
    tuesday: t("weekdaysFull.tuesday"),
    wednesday: t("weekdaysFull.wednesday"),
    thursday: t("weekdaysFull.thursday"),
    friday: t("weekdaysFull.friday"),
    saturday: t("weekdaysFull.saturday"),
    sunday: t("weekdaysFull.sunday"),
  };

  const selectedFormId = useWatch({ control: form.control, name: "formId" });
  const selectedForm = forms.find((item) => item.id === selectedFormId) ?? null;
  const selectedDefinition = selectedForm?.latestVersion.definition ?? null;
  const measurementFields = selectedDefinition
    ? getMeasurementFields(selectedDefinition)
    : [];
  const watchedScheduledTimes = useWatch({
    control: form.control,
    name: "scheduledTimeRows",
  });
  const { isSubmitting, errors, isDirty } = useFormState({
    control: form.control,
  });

  const hasChanges = !isEditing || !task || isDirty;

  const duplicateTimeIndices = findDuplicateScheduledTimeIndices(
    watchedScheduledTimes.map((row) => row.time),
  );

  const opensField = useController({
    name: "completionOpensBeforeMinutes",
    control: form.control,
  });
  const dueField = useController({
    name: "completionDueAfterMinutes",
    control: form.control,
  });

  function handleOpensPresetChange(preset: CompletionOpensPreset) {
    setFormUi((previous) => ({ ...previous, opensPreset: preset }));

    form.setValue(
      "completionOpensBeforeMinutes",
      preset === "custom"
        ? CUSTOM_MINUTES_INITIAL_VALUE
        : String(COMPLETION_OPENS_PRESET_MINUTES[preset]),
      { shouldDirty: true, shouldTouch: true },
    );
    form.clearErrors("completionOpensBeforeMinutes");
  }

  function handleDuePresetChange(preset: CompletionDuePreset) {
    setFormUi((previous) => ({ ...previous, duePreset: preset }));

    if (preset === "never") {
      form.setValue("neverOverdue", true, { shouldDirty: true });
      form.clearErrors("completionDueAfterMinutes");
      return;
    }

    form.setValue("neverOverdue", false, { shouldDirty: true });
    form.setValue(
      "completionDueAfterMinutes",
      preset === "custom"
        ? CUSTOM_MINUTES_INITIAL_VALUE
        : String(COMPLETION_DUE_PRESET_MINUTES[preset]),
      { shouldDirty: true, shouldTouch: true },
    );
    form.clearErrors("completionDueAfterMinutes");
  }

  async function handleValidSubmit(values: TaskTemplatesFormValues) {
    if (
      findDuplicateScheduledTimeIndices(
        values.scheduledTimeRows.map((row) => row.time),
      ).size > 0
    ) {
      return;
    }

    const definition =
      forms.find((item) => item.id === values.formId)?.latestVersion
        .definition ?? null;
    const { targets: targetInputs, issues } = toTargetInputs(
      values.targets,
      definition,
    );
    setFormUi((previous) => ({ ...previous, overrideIssues: issues }));
    if (Object.keys(issues).length > 0) return;

    if (
      isEditing &&
      task &&
      !hasTaskChanges({ ...values, targets: targetInputs }, task)
    ) {
      onOpenChange(false);
      return;
    }

    const payload: TaskTemplateFieldsInput = {
      title: values.title,
      formId: values.formId,
      weekdays: values.weekdays,
      scheduledTimes: values.scheduledTimeRows.map((row) => row.time),
      targets: targetInputs,
      completionOpensBeforeMinutes: Number(values.completionOpensBeforeMinutes),
      completionDueAfterMinutes: values.neverOverdue
        ? null
        : Number(values.completionDueAfterMinutes),
    };

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      showApiError(error);
    }
  }

  const scheduledTimeRowsError = errors.scheduledTimeRows;
  const scheduledTimeRowsErrorMessage = getScheduledTimeRowsErrorMessage(
    scheduledTimeRowsError,
  );
  const scheduledTimeRowsGroupError = scheduledTimeRowsErrorMessage
    ? scheduledTimeRowsErrorMessage
    : duplicateTimeIndices.size > 0
      ? t("validation.timesUnique")
      : undefined;

  const submitLabel = isEditing ? t("save") : t("add");
  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;

  const formFooter = (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        className="max-md:hidden"
        onClick={() => onOpenChange(false)}
      >
        {t("cancel")}
      </Button>
      <Button
        type="submit"
        form={TASK_TEMPLATES_FORM_ID}
        isLoading={isSubmitting}
        disabled={isEditing && !hasChanges}
      >
        <SubmitIcon data-icon="inline-start" />
        {submitLabel}
      </Button>
    </DialogFooter>
  );

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing
          ? t("editTitle")
          : isDuplicating
            ? t("duplicateTitle")
            : t("addTitle")
      }
      description={
        isEditing
          ? t("editDescription")
          : isDuplicating
            ? t("duplicateDescription")
            : t("addDescription")
      }
      initialFocus={isEditing || isDuplicating ? undefined : false}
      closeLabel={t("cancel")}
      footer={formFooter}
      className="sm:max-w-lg"
    >
      <form
        id={TASK_TEMPLATES_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
        className="grid gap-6"
      >
        <FieldSet className="gap-4">
          <FieldLegend variant="label">{t("sections.details")}</FieldLegend>

          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TASK_TEMPLATES_FORM_ID}-title`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("titleLabel")}
                </FieldLabel>
                <Input
                  {...field}
                  ref={(node) => {
                    field.ref(node);
                    titleRef.current = node;
                  }}
                  id={`${TASK_TEMPLATES_FORM_ID}-title`}
                  aria-invalid={fieldState.invalid}
                  placeholder={t("titlePlaceholder")}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="formId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TASK_TEMPLATES_FORM_ID}-form`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("formLabel")}
                </FieldLabel>
                <Select
                  name={field.name}
                  items={forms.map((item) => ({
                    label: item.name,
                    value: item.id,
                  }))}
                  value={field.value || null}
                  onValueChange={(value: unknown) =>
                    field.onChange(typeof value === "string" ? value : "")
                  }
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen) field.onBlur();
                  }}
                >
                  <SelectTrigger
                    id={`${TASK_TEMPLATES_FORM_ID}-form`}
                    aria-invalid={fieldState.invalid}
                    className="w-full"
                  >
                    <SelectValue placeholder={t("formPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {forms.map((item) => {
                        const Icon = FORM_CATEGORY_ICONS[item.category];
                        return (
                          <SelectItem key={item.id} value={item.id}>
                            <Icon className="text-muted-foreground" />
                            {item.name}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {forms.length === 0 ? (
                  <FieldDescription>
                    {t("noForms")}{" "}
                    <Link href="/dashboard/forms" className="underline">
                      {t("manageForms")}
                    </Link>
                  </FieldDescription>
                ) : null}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldSet>

        <FieldSeparator />

        <FieldSet className="gap-3">
          <FieldLegend variant="label" className="mb-0">
            {t("targets.legend")}
          </FieldLegend>
          <FieldDescription>{t("targets.description")}</FieldDescription>
          <Controller
            name="targets"
            control={form.control}
            render={({ field }) => (
              <TargetPicker
                id={`${TASK_TEMPLATES_FORM_ID}-targets`}
                targets={targets}
                measurementFields={measurementFields}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next);
                  setFormUi((previous) => ({
                    ...previous,
                    overrideIssues: {},
                  }));
                }}
                issues={overrideIssues}
              />
            )}
          />
        </FieldSet>

        <FieldSeparator />

        <FieldSet className="gap-4">
          <FieldLegend variant="label">{t("sections.schedule")}</FieldLegend>

          <Controller
            name="weekdays"
            control={form.control}
            render={({ field, fieldState }) => (
              <WeekdayToggleStrip
                id={`${TASK_TEMPLATES_FORM_ID}-weekdays`}
                label={t("weekdaysLabel")}
                value={field.value}
                shortLabels={weekdayShortLabels}
                fullLabels={weekdayFullLabels}
                everyDayLabel={t("presets.everyDay")}
                weekdaysLabel={t("presets.weekdays")}
                invalid={fieldState.invalid}
                errorMessage={fieldState.error?.message}
                onValueChange={(nextValue) => {
                  field.onChange(nextValue);
                  if (nextValue.length > 0) {
                    form.clearErrors("weekdays");
                  }
                }}
                onBlur={field.onBlur}
              />
            )}
          />

          <FieldSet
            className="gap-3"
            data-invalid={Boolean(scheduledTimeRowsGroupError)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <FieldLegend
                variant="label"
                className={cn(REQUIRED_LABEL_CLASS, "mb-0")}
              >
                {t("timesLabel")}
              </FieldLegend>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fields.length}/{TASK_TEMPLATE_MAX_SCHEDULED_TIMES}
              </span>
            </div>
            {fields.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {fields.map((field, index) => {
                  const isDuplicate = duplicateTimeIndices.has(index);
                  return (
                    <Controller
                      key={field.id}
                      name={`scheduledTimeRows.${index}.time`}
                      control={form.control}
                      render={({ field: timeField, fieldState }) => (
                        <ScheduledTimeRow
                          id={`${TASK_TEMPLATES_FORM_ID}-time-${index}`}
                          value={timeField.value}
                          aria-invalid={fieldState.invalid || isDuplicate}
                          autoFocus={autoFocusTimeIndex === index}
                          onChange={timeField.onChange}
                          onBlur={timeField.onBlur}
                          onRemove={() => {
                            remove(index);
                            setAutoFocusTimeIndex(null);
                          }}
                        />
                      )}
                    />
                  );
                })}
              </div>
            ) : null}
            {fields.length < TASK_TEMPLATE_MAX_SCHEDULED_TIMES ? (
              <Button
                type="button"
                variant="outline"
                className="h-(--control-h) w-full"
                onClick={() => {
                  const nextIndex = fields.length;
                  append(
                    {
                      time: getNextDefaultScheduledTime(
                        watchedScheduledTimes.map((row) => row.time),
                      ),
                    },
                    { shouldFocus: false },
                  );
                  setAutoFocusTimeIndex(nextIndex);
                }}
              >
                <PlusIcon />
                {t("addTime")}
              </Button>
            ) : null}
            {scheduledTimeRowsGroupError ? (
              <FieldError>{scheduledTimeRowsGroupError}</FieldError>
            ) : null}
          </FieldSet>

          <FieldSet className="gap-3">
            <FieldLegend variant="label">
              {t("completionWindow.legend")}
            </FieldLegend>
            <CompletionWindowFields
              idPrefix={TASK_TEMPLATES_FORM_ID}
              opensValue={opensField.field.value}
              onOpensChange={opensField.field.onChange}
              onOpensBlur={opensField.field.onBlur}
              opensInvalid={opensField.fieldState.invalid}
              opensErrorMessage={opensField.fieldState.error?.message}
              opensPreset={opensPreset}
              onOpensPresetChange={handleOpensPresetChange}
              dueValue={dueField.field.value}
              onDueChange={dueField.field.onChange}
              onDueBlur={dueField.field.onBlur}
              dueInvalid={dueField.fieldState.invalid}
              dueErrorMessage={dueField.fieldState.error?.message}
              duePreset={duePreset}
              onDuePresetChange={handleDuePresetChange}
            />
          </FieldSet>
        </FieldSet>

        <FieldSeparator />
      </form>
    </ResponsiveFormDialog>
  );
}
