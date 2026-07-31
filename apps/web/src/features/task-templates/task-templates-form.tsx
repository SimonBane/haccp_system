"use client";

import {
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  TASK_TEMPLATE_WEEKDAYS,
  TASK_TEMPLATE_WEEKDAYS_MON_FRI,
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
import { CopyPlusIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isEveryDayWeekdays,
  isMonFriWeekdays,
} from "@/features/task-templates/lib/format-schedule";
import { ScheduledTimeRow } from "@/features/task-templates/components/scheduled-time-row";
import { cn } from "@/lib/utils";

type WeekdayPreset = "everyDay" | "monFri" | "custom" | "none";

function getWeekdayPreset(weekdays: TaskTemplateWeekday[]): WeekdayPreset {
  if (weekdays.length === 0) {
    return "none";
  }

  if (isEveryDayWeekdays(weekdays)) {
    return "everyDay";
  }

  if (isMonFriWeekdays(weekdays)) {
    return "monFri";
  }

  return "custom";
}

const TASK_TYPES: TaskTemplateType[] = ["temperature", "cleaning"];

const TASK_TEMPLATES_FORM_ID = "task-templates-form";

const REQUIRED_LABEL_CLASS =
  "gap-1 after:text-destructive after:content-['*']";

const SCHEDULED_TIME_SLOT_CLASS =
  "w-full min-w-0 sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-1.5rem)/4)]";

const WEEKDAY_TOGGLE_GROUP_CLASS =
  "w-full flex flex-wrap gap-1.5";

const WEEKDAY_PRESET_ITEM_CLASS =
  "min-h-10 min-w-[calc(33%-0.375rem)] flex-1 cursor-pointer aria-pressed:!border-primary aria-pressed:!bg-primary aria-pressed:!text-primary-foreground aria-pressed:hover:!bg-primary/80";

const WEEKDAY_TOGGLE_ITEM_CLASS =
  "min-h-10 cursor-pointer aria-pressed:!border-primary aria-pressed:!bg-primary aria-pressed:!text-primary-foreground aria-pressed:hover:!bg-primary/80";

function hasDuplicateScheduledTimes(times: string[]): boolean {
  const filledTimes = times.filter(Boolean);
  return new Set(filledTimes).size !== filledTimes.length;
}

function getScheduledTimeRowsErrorMessage(
  error: unknown,
): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  if ("message" in error && error.message) {
    return String(error.message);
  }

  if (
    "root" in error &&
    error.root &&
    typeof error.root === "object" &&
    "message" in error.root &&
    error.root.message
  ) {
    return String(error.root.message);
  }

  return undefined;
}

type ScheduledTimeRowValue = {
  time: string;
};

type TaskTemplatesFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskTemplateResponse | null;
  duplicateSource?: TaskTemplateResponse | null;
  suggestedDuplicateTitle?: string;
  equipment: Pick<EquipmentResponse, "id" | "name">[];
  onDuplicate?: () => void;
  onSubmit: (values: TaskTemplateFieldsInput) => Promise<void>;
};

function buildDefaultTimeRows(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): ScheduledTimeRowValue[] {
  const source = task ?? duplicateSource;
  if (source && source.scheduledTimes.length > 0) {
    return source.scheduledTimes.map((time) => ({ time }));
  }

  return [];
}

function buildDefaultWeekdays(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): TaskTemplateWeekday[] {
  const source = task ?? duplicateSource;
  if (source) {
    return source.weekdays;
  }

  return [];
}

function hasTaskChanges(
  values: {
    title: string;
    type: TaskTemplateType | "";
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    equipmentId: string | null;
  },
  task: TaskTemplateResponse,
): boolean {
  const nextTimes = values.scheduledTimeRows.map((row) => row.time);

  const weekdaysChanged =
    values.weekdays.length !== task.weekdays.length ||
    values.weekdays.some((weekday) => !task.weekdays.includes(weekday));

  const timesChanged =
    nextTimes.length !== task.scheduledTimes.length ||
    nextTimes.some((time) => !task.scheduledTimes.includes(time));

  return (
    values.title !== task.title ||
    values.type !== task.type ||
    weekdaysChanged ||
    timesChanged ||
    values.equipmentId !== task.equipmentId
  );
}

export function TaskTemplatesForm({
  open,
  onOpenChange,
  task,
  duplicateSource,
  suggestedDuplicateTitle,
  equipment,
  onDuplicate,
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
            message: t("validation.typeRequired"),
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
                      code: z.ZodIssueCode.custom,
                      message: t("validation.timeRequired"),
                    });
                    return;
                  }

                  const result = scheduledTimeSchema.safeParse(value);
                  if (!result.success) {
                    ctx.addIssue({
                      code: z.ZodIssueCode.custom,
                      message: t("validation.timeInvalid"),
                    });
                  }
                }),
            }),
          )
          .min(1, t("validation.timesRequired"))
          .max(TASK_TEMPLATE_MAX_SCHEDULED_TIMES, t("validation.timesMax")),
        equipmentId: z.string().uuid().nullable(),
      })
      .superRefine((data, ctx) => {
        if (data.type === "temperature" && !data.equipmentId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
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

  const form = useForm<TaskTemplatesFormValues>({
    resolver: zodResolver(tasksFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "scheduledTimeRows",
  });

  const [weekdayPreset, setWeekdayPreset] = useState<WeekdayPreset>(() =>
    getWeekdayPreset(defaultValues.weekdays),
  );
  const [autoFocusTimeIndex, setAutoFocusTimeIndex] = useState<number | null>(
    null,
  );
  const [duplicateTimesError, setDuplicateTimesError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
    setWeekdayPreset(getWeekdayPreset(defaultValues.weekdays));
    setAutoFocusTimeIndex(null);
    setDuplicateTimesError(null);
  }, [open, defaultValues, form]);

  useEffect(() => {
    if (!open || !duplicateSource || task) return;

    const timeoutId = window.setTimeout(() => {
      form.setFocus("title", { shouldSelect: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, task, duplicateSource, form]);

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

  const formFooter = (
    <DialogFooter>
      {isEditing ? (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onDuplicate}
          >
            <CopyPlusIcon data-icon="inline-start" />
            {t("duplicate")}
          </Button>
          <Button
            type="submit"
            form={TASK_TEMPLATES_FORM_ID}
            isLoading={isSubmitting}
            disabled={!hasChanges}
          >
            <SaveIcon data-icon="inline-start" />
            {t("save")}
          </Button>
        </>
      ) : (
        <Button
          type="submit"
          form={TASK_TEMPLATES_FORM_ID}
          isLoading={isSubmitting}
        >
          <PlusIcon data-icon="inline-start" />
          {t("add")}
        </Button>
      )}
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
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={REQUIRED_LABEL_CLASS}>
                    {t("weekdaysLabel")}
                  </FieldLabel>
                  <ToggleGroup
                    spacing={0}
                    variant="outline"
                    className={WEEKDAY_TOGGLE_GROUP_CLASS}
                    value={
                      weekdayPreset === "none" ? [] : [weekdayPreset]
                    }
                    onValueChange={(values) => {
                      const nextPreset = values[values.length - 1] as
                        | WeekdayPreset
                        | undefined;

                      if (!nextPreset || nextPreset === "none") return;

                      if (nextPreset === "everyDay") {
                        setWeekdayPreset("everyDay");
                        field.onChange([...TASK_TEMPLATE_WEEKDAYS]);
                        field.onBlur();
                        return;
                      }

                      if (nextPreset === "monFri") {
                        setWeekdayPreset("monFri");
                        field.onChange([...TASK_TEMPLATE_WEEKDAYS_MON_FRI]);
                        field.onBlur();
                        return;
                      }

                      setWeekdayPreset("custom");
                      form.setValue("weekdays", [], {
                        shouldValidate: false,
                        shouldDirty: true,
                      });
                      form.clearErrors("weekdays");
                    }}
                  >
                    <ToggleGroupItem
                      value="everyDay"
                      className={WEEKDAY_PRESET_ITEM_CLASS}
                    >
                      {t("presets.everyDay")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="monFri"
                      className={WEEKDAY_PRESET_ITEM_CLASS}
                    >
                      {t("presets.monFri")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="custom"
                      className={WEEKDAY_PRESET_ITEM_CLASS}
                    >
                      {t("presets.custom")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {weekdayPreset === "custom" ? (
                    <ToggleGroup
                      multiple
                      spacing={0}
                      variant="outline"
                      className={WEEKDAY_TOGGLE_GROUP_CLASS}
                      value={field.value}
                      onValueChange={(values) => {
                        const nextValue = values as TaskTemplateWeekday[];

                        form.setValue("weekdays", nextValue, {
                          shouldValidate: false,
                          shouldDirty: true,
                        });
                        if (nextValue.length > 0) {
                          form.clearErrors("weekdays");
                        }
                      }}
                    >
                      {TASK_TEMPLATE_WEEKDAYS.map((weekday) => (
                        <ToggleGroupItem
                          key={weekday}
                          value={weekday}
                          className={cn(
                            "min-w-[calc(14%-0.25rem)] flex-1 px-1",
                            WEEKDAY_TOGGLE_ITEM_CLASS,
                          )}
                          aria-label={weekdayShortLabels[weekday]}
                        >
                          {weekdayShortLabels[weekday]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  ) : null}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
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
                    "shrink-0 px-2",
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
