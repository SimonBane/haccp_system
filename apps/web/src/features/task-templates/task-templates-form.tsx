"use client";

import {
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  TASK_TEMPLATE_ALL_WEEKDAYS,
  TASK_TEMPLATE_WEEKDAYS,
  scheduledTimeSchema,
  taskTemplateTypeSchema,
  taskTemplateWeekdaySchema,
  type EquipmentResponse,
  type TaskTemplateFieldsInput,
  type TaskTemplateResponse,
  type TaskTemplateType,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api-utils";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
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
  buildDefaultTimeRows,
  buildDefaultWeekdays,
  getScheduledTimeRowsErrorMessage,
  getWeekdayPreset,
  hasDuplicateScheduledTimes,
  hasTaskChanges,
  TASK_TYPES,
  WEEKDAY_PRESET_OPTIONS,
  type ScheduledTimeRowValue,
  type WeekdayPreset,
} from "@/features/task-templates/lib/form-helpers";
import { ScheduledTimeRow } from "@/features/task-templates/components/scheduled-time-row";
import { WeekdayMultiSelect } from "@/features/task-templates/components/weekday-multi-select";
import { cn } from "@/lib/utils";




const TASK_TEMPLATES_FORM_ID = "task-templates-form";

const SCHEDULED_TIME_SLOT_CLASS =
  "w-full min-w-0 sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-1.5rem)/4)]";

type TaskTemplatesFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskTemplateResponse | null;
  duplicateSource?: TaskTemplateResponse | null;
  suggestedDuplicateTitle?: string;
  equipment: Pick<EquipmentResponse, "id" | "name">[];
  onSubmit: (values: TaskTemplateFieldsInput) => Promise<void>;
};




export function TaskTemplatesForm({
  open,
  onOpenChange,
  task,
  duplicateSource,
  suggestedDuplicateTitle,
  equipment,
  onSubmit,
}: TaskTemplatesFormProps) {
  const t = useTranslations("TasksPage");
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
        type: z
          .union([taskTemplateTypeSchema, z.literal("")])
          .refine((value): value is TaskTemplateType => value !== "", {
            error: t("validation.typeRequired"),
          }),
        weekdays: z
          .array(taskTemplateWeekdaySchema)
          .min(1, t("validation.weekdaysRequired")),
        scheduledTimeRows: z
          .array(
            z.object({
              time: z
                .string()
                .superRefine((value, ctx) => {
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
        equipmentId: z.uuid().nullable(),
      })
      .superRefine((data, ctx) => {
        if (data.type === "temperature" && !data.equipmentId) {
          ctx.addIssue({
            code: "custom",
            message: t("validation.equipmentRequired"),
            path: ["equipmentId"],
          });
        }
      });
  }, [t]);

  type TaskTemplatesFormValues = {
    title: string;
    type: TaskTemplateType | "";
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    equipmentId: string | null;
  };

  const defaultValues = useMemo((): TaskTemplatesFormValues => {
    const source = task ?? duplicateSource;

    return {
      title:
        task?.title ??
        (duplicateSource
          ? (suggestedDuplicateTitle ?? duplicateSource.title)
          : ""),
      type: source?.type ?? "",
      weekdays: buildDefaultWeekdays(task, duplicateSource),
      scheduledTimeRows: buildDefaultTimeRows(task, duplicateSource),
      equipmentId: source?.equipmentId ?? null,
    };
  }, [task, duplicateSource, suggestedDuplicateTitle]);

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

  /*
   * The three bits of scheduling state that are not the form's values, held
   * together because they are always reset together — once per open.
   *
   * One object rather than three `useState`s so the reset below is a single
   * update: three in a row inside an effect is a cascade of renders, and the
   * remount that used to do this instead is what broke the sheet's slide-in.
   */
  const [scheduleUi, setScheduleUi] = useState<{
    weekdayPreset: WeekdayPreset;
    autoFocusTimeIndex: number | null;
    duplicateTimesError: string | null;
  }>(() => ({
    weekdayPreset: getWeekdayPreset(defaultValues.weekdays),
    autoFocusTimeIndex: null,
    duplicateTimesError: null,
  }));
  const { weekdayPreset, autoFocusTimeIndex, duplicateTimesError } = scheduleUi;

  const setWeekdayPreset = (next: WeekdayPreset) =>
    setScheduleUi((previous) => ({ ...previous, weekdayPreset: next }));
  const setAutoFocusTimeIndex = (next: number | null) =>
    setScheduleUi((previous) => ({ ...previous, autoFocusTimeIndex: next }));
  const setDuplicateTimesError = (next: string | null) =>
    setScheduleUi((previous) => ({ ...previous, duplicateTimesError: next }));
  const skipWeekdaysBlurRef = useRef(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  /*
   * Reset on open, driven by the prop rather than by the open handler: the
   * parent opens this by flipping `open`, which never calls `onOpenChange`.
   *
   * This used to be a remount via a changing `key`. That reset everything for
   * free, but a sheet that mounts already-open has no closed state to
   * transition from, so the slide-in was skipped every time the record changed
   * — which is why the first open after switching records never animated.
   *
   * The UI state is adjusted during render, the documented way to reset state
   * when a prop changes; only `form.reset` goes in an effect, because that is
   * the part talking to something outside React.
   */
  const [openedValues, setOpenedValues] =
    useState<TaskTemplatesFormValues | null>(null);

  // Cleared back to null while closed, so reopening the *same* record still
  // counts as a fresh open — `defaultValues` keeps its identity in that case and
  // comparing on it alone would leave last session's weekday preset behind.
  const openedTarget = open ? defaultValues : null;

  if (openedValues !== openedTarget) {
    setOpenedValues(openedTarget);
    if (openedTarget) {
      setScheduleUi({
        weekdayPreset: getWeekdayPreset(openedTarget.weekdays),
        autoFocusTimeIndex: null,
        duplicateTimesError: null,
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const typeLabels: Record<TaskTemplateType, string> = {
    temperature: t("types.temperature"),
    cleaning: t("types.cleaning"),
    other: t("types.other"),
  };

  const weekdayShortLabels: Record<TaskTemplateWeekday, string> = {
    monday: t("weekdaysShort.monday"),
    tuesday: t("weekdaysShort.tuesday"),
    wednesday: t("weekdaysShort.wednesday"),
    thursday: t("weekdaysShort.thursday"),
    friday: t("weekdaysShort.friday"),
    saturday: t("weekdaysShort.saturday"),
    sunday: t("weekdaysShort.sunday"),
  };

  const selectedType = useWatch({ control: form.control, name: "type" });
  const { isSubmitting, errors, isDirty } = useFormState({
    control: form.control,
  });

  const hasChanges = !isEditing || !task || isDirty;

  function validateScheduledTimeUniqueness() {
    const times = form.getValues("scheduledTimeRows").map((row) => row.time);

    if (hasDuplicateScheduledTimes(times)) {
      setDuplicateTimesError(t("validation.timesUnique"));
      return false;
    }

    setDuplicateTimesError(null);
    return true;
  }

  async function handleValidSubmit(values: TaskTemplatesFormValues) {
    if (!validateScheduledTimeUniqueness()) {
      return;
    }

    if (isEditing && task && !hasTaskChanges(values, task)) {
      onOpenChange(false);
      return;
    }

    if (!values.type) return;

    const payload: TaskTemplateFieldsInput = {
      title: values.title,
      type: values.type,
      weekdays: values.weekdays,
      scheduledTimes: values.scheduledTimeRows.map((row) => row.time),
      equipmentId: values.type === "temperature" ? values.equipmentId : null,
    };

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "CONFLICT") {
        toast.error(error.message);
        return;
      }
      toast.error(
        error instanceof Error ? error.message : t("submitError"),
      );
    }
  }

  const scheduledTimeRowsError = errors.scheduledTimeRows;
  const scheduledTimeRowsErrorMessage =
    duplicateTimesError ??
    getScheduledTimeRowsErrorMessage(scheduledTimeRowsError);

  function handleScheduledTimesChange(update: () => void) {
    update();
    setDuplicateTimesError(null);
  }

  function handleScheduledTimeBlur(
    onBlur: () => void,
    index: number,
  ) {
    onBlur();
    void form.trigger(`scheduledTimeRows.${index}.time`).then(() => {
      validateScheduledTimeUniqueness();
    });
  }

  // Duplicate is reached from the row's action menu on both platforms now —
  // see the note in equipment-form.
  const submitLabel = isEditing ? t("save") : t("add");
  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;

  const formFooter = (
    <DialogFooter>
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
      autoFocusField={{
        ref: titleRef,
        selection: isEditing || isDuplicating ? "select" : "none",
      }}
      actions={{
        items: [
          {
            label: submitLabel,
            formId: TASK_TEMPLATES_FORM_ID,
            isLoading: isSubmitting,
            disabled: isEditing && !hasChanges,
          },
        ],
      }}
      footer={formFooter}
    >
        <form
          id={TASK_TEMPLATES_FORM_ID}
          onSubmit={form.handleSubmit(handleValidSubmit)}
          className="grid gap-6"
        >
          <FieldGroup>
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
              name="type"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel
                    htmlFor={`${TASK_TEMPLATES_FORM_ID}-type`}
                    className={REQUIRED_LABEL_CLASS}
                  >
                    {t("typeLabel")}
                  </FieldLabel>
                  <Select
                    name={field.name}
                    items={TASK_TYPES.map((type) => ({
                      label: typeLabels[type],
                      value: type,
                    }))}
                    value={field.value || null}
                    onValueChange={(value: unknown) => {
                      const nextType = value as TaskTemplateType;
                      field.onChange(nextType);
                      if (nextType !== "temperature") {
                        form.setValue("equipmentId", null);
                      }
                    }}
                    onOpenChange={(nextOpen) => {
                      if (!nextOpen) {
                        field.onBlur();
                      }
                    }}
                  >
                    <SelectTrigger
                      id={`${TASK_TEMPLATES_FORM_ID}-type`}
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue placeholder={t("typePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {TASK_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {typeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {selectedType === "temperature" ? (
              <Controller
                name="equipmentId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor={`${TASK_TEMPLATES_FORM_ID}-equipment`}
                      className={REQUIRED_LABEL_CLASS}
                    >
                      {t("equipmentLabel")}
                    </FieldLabel>
                    <Select
                      name={field.name}
                      items={equipment.map((item) => ({
                        label: item.name,
                        value: item.id,
                      }))}
                      value={field.value ?? null}
                      onValueChange={(value: unknown) => {
                        field.onChange(
                          typeof value === "string" ? value : null,
                        );
                      }}
                      onOpenChange={(nextOpen) => {
                        if (!nextOpen) {
                          field.onBlur();
                        }
                      }}
                    >
                      <SelectTrigger
                        id={`${TASK_TEMPLATES_FORM_ID}-equipment`}
                        aria-invalid={fieldState.invalid}
                        className="w-full"
                      >
                        <SelectValue placeholder={t("equipmentPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {equipment.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ) : null}

            <Controller
              name="weekdays"
              control={form.control}
              render={({ field, fieldState }) => (
                <>
                  <Field
                    data-invalid={
                      fieldState.invalid && weekdayPreset !== "custom"
                    }
                  >
                    <FieldLabel
                      htmlFor={`${TASK_TEMPLATES_FORM_ID}-schedule`}
                      className={REQUIRED_LABEL_CLASS}
                    >
                      {t("weekdaysLabel")}
                    </FieldLabel>
                    <Select
                      items={WEEKDAY_PRESET_OPTIONS.map((preset) => ({
                        label: t(`presets.${preset}`),
                        value: preset,
                      }))}
                      value={weekdayPreset === "none" ? null : weekdayPreset}
                      onValueChange={(value: unknown) => {
                        const nextPreset = value as
                          | Exclude<WeekdayPreset, "none">
                          | null;

                        if (!nextPreset) return;

                        if (nextPreset === "everyDay") {
                          setWeekdayPreset("everyDay");
                          field.onChange([...TASK_TEMPLATE_ALL_WEEKDAYS]);
                          field.onBlur();
                          return;
                        }

                        if (nextPreset === "weekdays") {
                          setWeekdayPreset("weekdays");
                          field.onChange([...TASK_TEMPLATE_WEEKDAYS]);
                          field.onBlur();
                          return;
                        }

                        setWeekdayPreset("custom");
                        skipWeekdaysBlurRef.current = true;
                        form.resetField("weekdays", {
                          defaultValue: [],
                          keepDirty: true,
                          keepTouched: false,
                          keepError: false,
                        });
                      }}
                      onOpenChange={(nextOpen) => {
                        if (!nextOpen) {
                          if (skipWeekdaysBlurRef.current) {
                            skipWeekdaysBlurRef.current = false;
                            return;
                          }
                          field.onBlur();
                        }
                      }}
                    >
                      <SelectTrigger
                        id={`${TASK_TEMPLATES_FORM_ID}-schedule`}
                        aria-invalid={
                          fieldState.invalid && weekdayPreset !== "custom"
                        }
                        className="w-full"
                      >
                        <SelectValue placeholder={t("schedulePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {WEEKDAY_PRESET_OPTIONS.map((preset) => (
                            <SelectItem key={preset} value={preset}>
                              {t(`presets.${preset}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && weekdayPreset !== "custom" ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                  {weekdayPreset === "custom" ? (
                    <Field
                      data-invalid={
                        fieldState.invalid &&
                        (fieldState.isTouched || form.formState.isSubmitted)
                      }
                    >
                      <FieldLabel
                        htmlFor={`${TASK_TEMPLATES_FORM_ID}-weekdays`}
                        className={REQUIRED_LABEL_CLASS}
                      >
                        {t("daysOfWeekLabel")}
                      </FieldLabel>
                      <WeekdayMultiSelect
                        id={`${TASK_TEMPLATES_FORM_ID}-weekdays`}
                        selectOnly
                        value={field.value}
                        labels={weekdayShortLabels}
                        invalid={
                          fieldState.invalid &&
                          (fieldState.isTouched || form.formState.isSubmitted)
                        }
                        placeholder={t("weekdaysPlaceholder")}
                        emptyMessage={t("weekdaysEmpty")}
                        moreSelectedLabel={(count) => t("moreSelected", { count })}
                        overflowRemoveLabel={(count) =>
                          t("overflowRemoveLabel", { count })
                        }
                        onValueChange={(nextValue) => {
                          field.onChange(nextValue);
                          if (nextValue.length > 0) {
                            form.clearErrors("weekdays");
                          }
                        }}
                        onBlur={field.onBlur}
                      />
                      {fieldState.invalid &&
                      (fieldState.isTouched || form.formState.isSubmitted) ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  ) : null}
                </>
              )}
            />
          </FieldGroup>

          <FieldSet
            className="gap-2"
            data-invalid={Boolean(scheduledTimeRowsErrorMessage)}
          >
            <FieldLegend variant="label" className={REQUIRED_LABEL_CLASS}>
              {t("timesLabel")}
            </FieldLegend>
            <div className="flex flex-row flex-wrap items-start gap-2">
              {fields.map((field, index) => (
                <Controller
                  key={field.id}
                  name={`scheduledTimeRows.${index}.time`}
                  control={form.control}
                  render={({ field: timeField, fieldState }) => (
                    <Field
                      className={SCHEDULED_TIME_SLOT_CLASS}
                      data-invalid={fieldState.invalid}
                    >
                      <ScheduledTimeRow
                        id={`${TASK_TEMPLATES_FORM_ID}-time-${index}`}
                        value={timeField.value}
                        aria-invalid={fieldState.invalid}
                        autoFocus={autoFocusTimeIndex === index}
                        onChange={(time) => {
                          handleScheduledTimesChange(() =>
                            timeField.onChange(time),
                          );
                        }}
                        onBlur={() =>
                          handleScheduledTimeBlur(timeField.onBlur, index)
                        }
                        onRemove={() => {
                          handleScheduledTimesChange(() => remove(index));
                          setAutoFocusTimeIndex(null);
                        }}
                        canRemove
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              ))}
              {fields.length < TASK_TEMPLATE_MAX_SCHEDULED_TIMES ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    SCHEDULED_TIME_SLOT_CLASS,
                    // Buttons default to 36px; the time fields beside it are
                    // --control-h, which is 44px on touch. Match them or the
                    // row of slots is visibly ragged on a phone.
                    "h-(--control-h) shrink-0 px-2",
                  )}
                  onClick={() => {
                    const nextIndex = fields.length;
                    handleScheduledTimesChange(() =>
                      append({ time: "08:00" }, { shouldFocus: false }),
                    );
                    setAutoFocusTimeIndex(nextIndex);
                  }}
                >
                  <PlusIcon />
                  <span className="truncate">{t("add")}</span>
                </Button>
              ) : null}
            </div>
            {scheduledTimeRowsErrorMessage ? (
              <FieldError>{scheduledTimeRowsErrorMessage}</FieldError>
            ) : null}
          </FieldSet>
        </form>
    </ResponsiveFormDialog>
  );
}
