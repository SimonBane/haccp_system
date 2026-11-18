"use client";

import {
  TARGET_NAME_MAX_LENGTH,
  API_ERROR_CODE,
  TARGET_KIND,
  TARGET_KIND_VALUES,
  isTargetNameTaken,
  type TargetInput,
  type TargetKind,
  type TargetResponse,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { Controller, useForm, useFormState, useWatch } from "react-hook-form";
import { z } from "zod";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KindPicker } from "@/features/targets/components/kind-picker";
import {
  areaWithDescendants,
  buildTargetTree,
  flattenAreas,
} from "@/features/targets/lib/target-tree";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";

const TARGETS_FORM_ID = "targets-form";
const NO_AREA = "none";
const DEPTH_INDENT = ["", "pl-6", "pl-9", "pl-12"];

type TargetsFormValues = { name: string; kind: TargetKind; parentId: string };

export type TargetsFormDefaults = {
  kind: TargetKind;
  parentId: string | null;
};

type TargetsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: TargetResponse | null;
  duplicateSource?: TargetResponse | null;
  suggestedDuplicateName?: string;
  /** Kind and area a new item starts with, e.g. from an area's "Add equipment". */
  defaults: TargetsFormDefaults;
  items: TargetResponse[];
  onSubmit: (values: TargetInput) => Promise<void>;
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
  const showApiError = useApiErrorToast();
  const kindLabelId = useId();
  const isEditing = Boolean(target);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;

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
      })
      .refine(
        (values) =>
          values.kind !== TARGET_KIND.FIXTURE || values.parentId !== NO_AREA,
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
      };
    }
    return {
      name: "",
      kind: defaults.kind,
      parentId: defaults.parentId ?? NO_AREA,
    };
  }, [target, duplicateSource, suggestedDuplicateName, defaults]);

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

  const kind = useWatch({ control: form.control, name: "kind" });
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
      // A fixture is part of a room, so it cannot stand alone.
      ...(kind === TARGET_KIND.FIXTURE
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

    const input: TargetInput = {
      name: values.name.trim(),
      kind: values.kind,
      parentId: values.parentId === NO_AREA ? null : values.parentId,
    };
    const takenMessage = t(
      input.kind === TARGET_KIND.FIXTURE ? "nameTakenFixture" : "nameTaken",
    );
    if (isTargetNameTaken(items, { ...input, id: target?.id })) {
      form.setError("name", { message: takenMessage });
      return;
    }

    try {
      await onSubmit(input);
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
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`form.${mode}Title.${kind}`)}
      description={t(`form.${mode}Description.${kind}`)}
      closeLabel={t("cancel")}
      initialFocus={isEditing || isDuplicating ? undefined : false}
      footer={
        <DialogFooter>
          <Button
            type="submit"
            form={TARGETS_FORM_ID}
            isLoading={isSubmitting}
            disabled={isEditing && !isDirty}
          >
            <SubmitIcon data-icon="inline-start" />
            {isEditing ? t("save") : t(`form.submit.${kind}`)}
          </Button>
        </DialogFooter>
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
                <FieldLabel
                  htmlFor={`${TARGETS_FORM_ID}-name`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("nameLabel")}
                </FieldLabel>
                <Input
                  {...field}
                  id={`${TARGETS_FORM_ID}-name`}
                  maxLength={TARGET_NAME_MAX_LENGTH}
                  aria-invalid={fieldState.invalid}
                  placeholder={t(`form.namePlaceholder.${kind}`)}
                />
                <div className="flex items-start justify-between gap-3">
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <span />
                  )}
                  <CharacterCount value={field.value} max={TARGET_NAME_MAX_LENGTH} />
                </div>
              </Field>
            )}
          />

          <Controller
            name="parentId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TARGETS_FORM_ID}-parent`}
                  className={
                    kind === TARGET_KIND.FIXTURE ? REQUIRED_LABEL_CLASS : undefined
                  }
                >
                  {t("form.parentLabel")}
                </FieldLabel>
                <Select
                  items={areaItems}
                  value={
                    kind === TARGET_KIND.FIXTURE && field.value === NO_AREA
                      ? null
                      : field.value
                  }
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
        </FieldGroup>
      </form>
    </ResponsiveFormDialog>
  );
}
