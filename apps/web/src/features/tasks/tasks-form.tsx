"use client";

import {
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  TASK_TEMPLATE_WEEKDAYS,
  TASK_TEMPLATE_WEEKDAYS_MON_FRI,
  composeScheduledTime,
  splitScheduledTime,
  taskTemplateTypeSchema,
  taskTemplateWeekdaySchema,
  type EquipmentResponse,
  type TaskTemplateFieldsInput,
  type TaskTemplateResponse,
  type TaskTemplateType,
  type TaskTemplateWeekday,
  type UpdateTaskTemplateInput,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { CopyPlusIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/features/tasks/format-schedule";
import { ScheduledTimeRow } from "@/features/tasks/scheduled-time-row";

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

const TASK_TYPES: TaskTemplateType[] = ["temperature", "cleaning", "other"];

type ScheduledTimeRowValue = {
  hour: string;
  minute: string;
};

type TasksFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskTemplateResponse | null;
  duplicateSource?: TaskTemplateResponse | null;
  suggestedDuplicateTitle?: string;
  equipment: Pick<EquipmentResponse, "id" | "name">[];
  onDuplicate?: () => void;
  onSubmit: (
    values: TaskTemplateFieldsInput | UpdateTaskTemplateInput,
  ) => Promise<void>;
};

function buildDefaultTimeRows(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): ScheduledTimeRowValue[] {
  const source = task ?? duplicateSource;
  if (source && source.scheduledTimes.length > 0) {
    return source.scheduledTimes.map((time) => splitScheduledTime(time));
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
  const nextTimes = values.scheduledTimeRows.map((row) =>
    composeScheduledTime(row.hour, row.minute),
  );

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

export function TasksForm({
  open,
  onOpenChange,
  task,
  duplicateSource,
  suggestedDuplicateTitle,
  equipment,
  onDuplicate,
  onSubmit,
}: TasksFormProps) {
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
              hour: z.string(),
              minute: z.string(),
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

        const composedTimes = data.scheduledTimeRows.map((row) =>
          composeScheduledTime(row.hour, row.minute),
        );
        const uniqueTimes = new Set(composedTimes);
        if (uniqueTimes.size !== composedTimes.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.timesUnique"),
            path: ["scheduledTimeRows"],
          });
        }
      });
  }, [t]);

  type TasksFormValues = {
    title: string;
    type: TaskTemplateType | "";
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    equipmentId: string | null;
  };

  const defaultValues = useMemo((): TasksFormValues => {
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

  const form = useForm<TasksFormValues>({
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
  const [autoOpenTimeIndex, setAutoOpenTimeIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
    setWeekdayPreset(getWeekdayPreset(defaultValues.weekdays));
    setAutoOpenTimeIndex(null);
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

  const watchedValues = form.watch();
  const selectedType = watchedValues.type;
  const hasChanges =
    !isEditing || !task || hasTaskChanges(watchedValues, task);

  async function handleValidSubmit(values: TasksFormValues) {
    if (isEditing && task && !hasTaskChanges(values, task)) {
      onOpenChange(false);
      return;
    }

    if (!values.type) return;

    const payload: TaskTemplateFieldsInput = {
      title: values.title,
      type: values.type,
      weekdays: values.weekdays,
      scheduledTimes: values.scheduledTimeRows.map((row) =>
        composeScheduledTime(row.hour, row.minute),
      ),
      equipmentId: values.type === "temperature" ? values.equipmentId : null,
    };

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("submitError"),
      );
    }
  }

  const { isSubmitting, errors } = form.formState;

  function handleScheduledTimesChange(update: () => void) {
    update();
    void form.trigger("scheduledTimeRows");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full sm:max-w-lg"
        initialFocus={isEditing || isDuplicating ? undefined : false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("editTitle")
              : isDuplicating
                ? t("duplicateTitle")
                : t("addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("editDescription")
              : isDuplicating
                ? t("duplicateDescription")
                : t("addDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleValidSubmit)}
            className="grid gap-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("titleLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("titlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("typeLabel")}</FormLabel>
                  <Select
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
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("typePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedType === "temperature" ? (
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t("equipmentLabel")}</FormLabel>
                    <Select
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
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("equipmentPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="weekdays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("weekdaysLabel")}</FormLabel>
                  <ButtonGroup className="w-full [&>[data-slot=button]]:flex-1">
                    <Button
                      type="button"
                      variant={
                        weekdayPreset === "everyDay" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setWeekdayPreset("everyDay");
                        field.onChange([...TASK_TEMPLATE_WEEKDAYS]);
                        field.onBlur();
                      }}
                    >
                      {t("presets.everyDay")}
                    </Button>
                    <Button
                      type="button"
                      variant={
                        weekdayPreset === "monFri" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setWeekdayPreset("monFri");
                        field.onChange([...TASK_TEMPLATE_WEEKDAYS_MON_FRI]);
                        field.onBlur();
                      }}
                    >
                      {t("presets.monFri")}
                    </Button>
                    <Button
                      type="button"
                      variant={
                        weekdayPreset === "custom" ? "default" : "outline"
                      }
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setWeekdayPreset("custom");
                        form.setValue("weekdays", [], {
                          shouldValidate: false,
                          shouldDirty: true,
                        });
                        form.clearErrors("weekdays");
                      }}
                    >
                      {t("presets.custom")}
                    </Button>
                  </ButtonGroup>
                  {weekdayPreset === "custom" ? (
                    <FormControl>
                      <ButtonGroup className="w-full [&>[data-slot=button]]:flex-1">
                        {TASK_TEMPLATE_WEEKDAYS.map((weekday) => {
                          const isSelected = field.value.includes(weekday);

                          return (
                            <Button
                              key={weekday}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="flex-1 px-1"
                              aria-label={weekdayShortLabels[weekday]}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const nextValue = isSelected
                                  ? field.value.filter(
                                      (value) => value !== weekday,
                                    )
                                  : [...field.value, weekday];

                                form.setValue("weekdays", nextValue, {
                                  shouldValidate: false,
                                  shouldDirty: true,
                                });
                                if (nextValue.length > 0) {
                                  form.clearErrors("weekdays");
                                }
                              }}
                            >
                              {weekdayShortLabels[weekday]}
                            </Button>
                          );
                        })}
                      </ButtonGroup>
                    </FormControl>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-2">
              <Label className="gap-1 after:text-destructive after:content-['*']">
                {t("timesLabel")}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`scheduledTimeRows.${index}`}
                    render={({ field: rowField }) => (
                      <div className="flex w-full min-w-0 sm:flex-1">
                        <ScheduledTimeRow
                          hour={rowField.value.hour}
                          minute={rowField.value.minute}
                          defaultOpen={autoOpenTimeIndex === index}
                          onHourChange={(hour) => {
                            handleScheduledTimesChange(() =>
                              rowField.onChange({ ...rowField.value, hour }),
                            );
                          }}
                          onMinuteChange={(minute) => {
                            handleScheduledTimesChange(() =>
                              rowField.onChange({
                                ...rowField.value,
                                minute,
                              }),
                            );
                          }}
                          onRemove={() => {
                            handleScheduledTimesChange(() => remove(index));
                            setAutoOpenTimeIndex(null);
                          }}
                          canRemove
                        />
                      </div>
                    )}
                  />
                ))}
                {fields.length < TASK_TEMPLATE_MAX_SCHEDULED_TIMES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => {
                      const nextIndex = fields.length;
                      handleScheduledTimesChange(() =>
                        append(
                          { hour: "08", minute: "00" },
                          { shouldFocus: false },
                        ),
                      );
                      setAutoOpenTimeIndex(nextIndex);
                    }}
                  >
                    <PlusIcon />
                    {t("addTime")}
                  </Button>
                ) : null}
              </div>
              {errors.scheduledTimeRows?.message ? (
                <p className="text-sm text-destructive">
                  {errors.scheduledTimeRows.message as string}
                </p>
              ) : null}
              {errors.scheduledTimeRows?.root?.message ? (
                <p className="text-sm text-destructive">
                  {errors.scheduledTimeRows.root.message}
                </p>
              ) : null}
            </div>

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
                    isLoading={isSubmitting}
                    disabled={!hasChanges}
                  >
                    <SaveIcon data-icon="inline-start" />
                    {t("save")}
                  </Button>
                </>
              ) : (
                <Button type="submit" isLoading={isSubmitting}>
                  <PlusIcon data-icon="inline-start" />
                  {t("add")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
