"use client";

import {
  API_ERROR_CODE,
  CORRECTIVE_ACTION_MODE,
  droppedOverridesDetailsSchema,
  FORM_CATEGORY_VALUES,
  fieldTypeSchema,
  getMeasurementFields,
  type FieldType,
  type FormCategory,
  type FormResponse,
  type MeasurementUnit,
  type StarterForm,
} from "@haccp/shared";
import { PlusIcon, SaveIcon, SendIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { cn } from "@/lib/utils";
import { useFormsMutations } from "../../hooks/use-forms-mutations";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import {
  BUILDER_LIMITS,
  createBuilderField,
  emptyBuilderState,
  hasBuilderIssues,
  moveField,
  sameDefinition,
  toBuilderState,
  toDefinition,
  validateBuilder,
  type BuilderField,
  type BuilderState,
} from "../../lib/form-builder";
import { decimalSeparator } from "../../lib/measurement";
import { FieldEditor } from "./field-editor";
import { FormPreview } from "./form-preview";
import { PublishDialog, type PublishStep } from "./publish-dialog";

const FORM_ID = "form-builder";

export type FormBuilderMode =
  | { kind: "create"; source: StarterForm | null }
  | { kind: "edit"; form: FormResponse };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A fresh object per open: its identity is what resets the builder. */
  mode: FormBuilderMode;
};

type UiState = {
  builder: BuilderState;
  expandedId: string | null;
  showIssues: boolean;
  nameTaken: boolean;
  view: "build" | "preview";
};

function initialUi(mode: FormBuilderMode, separator: string): UiState {
  const builder =
    mode.kind === "edit"
      ? toBuilderState(
          {
            name: mode.form.name,
            category: mode.form.category,
            definition: mode.form.latestVersion.definition,
          },
          separator,
        )
      : mode.source
        ? toBuilderState(mode.source, separator)
        : emptyBuilderState();

  return {
    builder,
    expandedId: null,
    showIssues: false,
    nameTaken: false,
    view: "build",
  };
}

export function FormBuilderDialog({ open, onOpenChange, mode }: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const showApiError = useApiErrorToast();
  const { create, update, publishVersion } = useFormsMutations();

  const [ui, setUi] = useState<UiState>(() => initialUi(mode, separator));
  const [openedMode, setOpenedMode] = useState<FormBuilderMode | null>(null);
  const [publishStep, setPublishStep] = useState<PublishStep | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset during render on each open; an effect would flash the previous form inside the opening sheet.
  const openTarget = open ? mode : null;
  if (openedMode !== openTarget) {
    setOpenedMode(openTarget);
    if (openTarget) {
      setUi(initialUi(openTarget, separator));
      setPublishStep(null);
    }
  }

  const { builder } = ui;
  const issues = validateBuilder(builder);
  const shownIssues = ui.showIssues ? issues : null;
  const isEditing = mode.kind === "edit";
  const previewDefinition = useMemo(() => toDefinition(builder), [builder]);

  const previousUnits = useMemo<Record<string, MeasurementUnit>>(
    () =>
      mode.kind === "edit"
        ? Object.fromEntries(
            getMeasurementFields(mode.form.latestVersion.definition).map(
              (field) => [field.id, field.unit],
            ),
          )
        : {},
    [mode],
  );

  function patchBuilder(patch: Partial<BuilderState>) {
    setUi((current) => ({
      ...current,
      builder: { ...current.builder, ...patch },
      nameTaken: patch.name === undefined ? current.nameTaken : false,
    }));
  }

  function setFields(update: (fields: BuilderField[]) => BuilderField[]) {
    setUi((current) => ({
      ...current,
      builder: { ...current.builder, fields: update(current.builder.fields) },
    }));
  }

  function addField(type: FieldType) {
    const field = createBuilderField(
      type,
      new Set(builder.fields.map((existing) => existing.id)),
      { optionLabels: [tForms("answers.yes"), tForms("answers.no")] },
    );
    setUi((current) => ({
      ...current,
      builder: {
        ...current.builder,
        fields: [...current.builder.fields, field],
      },
      expandedId: field.id,
      view: "build",
    }));
  }

  async function runSave(action: () => Promise<unknown>, message: string) {
    setIsSaving(true);
    try {
      await action();
      toast.success(message);
      setPublishStep(null);
      onOpenChange(false);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.FORM_NAME_EXISTS
      ) {
        setPublishStep(null);
        setUi((current) => ({ ...current, nameTaken: true, view: "build" }));
        return;
      }

      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES &&
        mode.kind === "edit"
      ) {
        const details = droppedOverridesDetailsSchema.safeParse(error.details);
        if (details.success) {
          setPublishStep({
            kind: "drops",
            nextVersion: mode.form.latestVersion.version + 1,
            dropped: details.data.droppedOverrides,
          });
          return;
        }
      }

      setPublishStep(null);
      showApiError(error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSave() {
    if (hasBuilderIssues(issues) || builder.category === "") {
      setUi((current) => ({
        ...current,
        showIssues: true,
        view: "build",
        expandedId: Object.keys(issues.byField)[0] ?? current.expandedId,
      }));
      return;
    }

    const definition = toDefinition(builder);
    const meta = { name: builder.name.trim(), category: builder.category };

    if (mode.kind === "create") {
      void runSave(
        () => create.mutateAsync({ ...meta, definition }),
        t("toast.created"),
      );
      return;
    }

    const { form } = mode;
    const metaChanged =
      meta.name !== form.name || meta.category !== form.category;
    const definitionChanged = !sameDefinition(
      definition,
      form.latestVersion.definition,
    );

    if (definitionChanged) {
      setPublishStep({
        kind: "confirm",
        nextVersion: form.latestVersion.version + 1,
      });
      return;
    }

    if (!metaChanged) {
      onOpenChange(false);
      return;
    }

    void runSave(
      () => update.mutateAsync({ id: form.id, input: meta }),
      t("toast.updated"),
    );
  }

  function handlePublish(step: PublishStep) {
    if (mode.kind !== "edit" || builder.category === "") return;

    const { form } = mode;
    const meta = { name: builder.name.trim(), category: builder.category };
    const metaChanged =
      meta.name !== form.name || meta.category !== form.category;
    const definition = toDefinition(builder);

    void runSave(
      async () => {
        // A refused version must not leave a renamed form behind, so the version goes first.
        await publishVersion.mutateAsync({
          id: form.id,
          definition,
          confirmDroppedOverrides: step.kind === "drops",
        });
        if (metaChanged) {
          await update.mutateAsync({ id: form.id, input: meta });
        }
      },
      t("toast.published", { version: step.nextVersion }),
    );
  }

  const categoryItems = FORM_CATEGORY_VALUES.map((category) => ({
    value: category,
    label: tForms(`categories.${category}`),
  }));
  const fieldTypes = fieldTypeSchema.options;
  const canAddField = builder.fields.length < BUILDER_LIMITS.maxFields;

  const settings = (
    <FieldSet className="gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field data-invalid={Boolean(shownIssues?.name) || ui.nameTaken}>
          <FieldLabel
            htmlFor={`${FORM_ID}-name`}
            className={REQUIRED_LABEL_CLASS}
          >
            {t("nameLabel")}
          </FieldLabel>
          <Input
            id={`${FORM_ID}-name`}
            value={builder.name}
            maxLength={200}
            placeholder={t("namePlaceholder")}
            aria-invalid={Boolean(shownIssues?.name) || ui.nameTaken}
            onChange={(event) => patchBuilder({ name: event.target.value })}
          />
          {shownIssues?.name ? (
            <FieldError errors={[{ message: t("errors.name") }]} />
          ) : ui.nameTaken ? (
            <FieldError errors={[{ message: t("errors.nameTaken") }]} />
          ) : null}
        </Field>
        <Field data-invalid={Boolean(shownIssues?.category)}>
          <FieldLabel
            htmlFor={`${FORM_ID}-category`}
            className={REQUIRED_LABEL_CLASS}
          >
            {t("categoryLabel")}
          </FieldLabel>
          <Select
            items={categoryItems}
            value={builder.category || null}
            onValueChange={(value: unknown) =>
              patchBuilder({ category: value as FormCategory })
            }
          >
            <SelectTrigger
              id={`${FORM_ID}-category`}
              aria-invalid={Boolean(shownIssues?.category)}
              className="w-full"
            >
              <SelectValue placeholder={t("categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {shownIssues?.category ? (
            <FieldError errors={[{ message: t("errors.category") }]} />
          ) : null}
        </Field>
      </div>
      <Field orientation="horizontal">
        <Switch
          id={`${FORM_ID}-corrective`}
          checked={
            builder.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
          }
          onCheckedChange={(required) =>
            patchBuilder({
              correctiveAction: required
                ? CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
                : CORRECTIVE_ACTION_MODE.OPTIONAL,
            })
          }
        />
        <div className="flex flex-col gap-0.5">
          <FieldLabel htmlFor={`${FORM_ID}-corrective`}>
            {t("correctiveLabel")}
          </FieldLabel>
          <FieldDescription>{t("correctiveDescription")}</FieldDescription>
        </div>
      </Field>
    </FieldSet>
  );

  const fieldList = (
    <FieldSet className="gap-3" data-invalid={shownIssues?.fields === "empty"}>
      <div className="flex items-center justify-between gap-2">
        <FieldLegend variant="label" className="mb-0">
          {t("fieldsLabel")}
        </FieldLegend>
        <span className="text-xs tabular-nums text-muted-foreground">
          {builder.fields.length}/{BUILDER_LIMITS.maxFields}
        </span>
      </div>

      {builder.fields.map((field, index) => (
        <FieldEditor
          key={field.id}
          idPrefix={FORM_ID}
          field={field}
          index={index}
          count={builder.fields.length}
          issues={shownIssues?.byField[field.id]}
          expanded={ui.expandedId === field.id}
          onToggle={() =>
            setUi((current) => ({
              ...current,
              expandedId: current.expandedId === field.id ? null : field.id,
            }))
          }
          onChange={(next) =>
            setFields((fields) =>
              fields.map((existing) =>
                existing.id === field.id ? next : existing,
              ),
            )
          }
          onMove={(delta) =>
            setFields((fields) => moveField(fields, index, delta))
          }
          onRemove={() =>
            setFields((fields) =>
              fields.filter((existing) => existing.id !== field.id),
            )
          }
        />
      ))}

      {shownIssues?.fields === "empty" ? (
        <FieldError errors={[{ message: t("errors.noFields") }]} />
      ) : null}

      {canAddField ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" className="w-full">
                <PlusIcon data-icon="inline-start" />
                {t("addField")}
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            {fieldTypes.map((type) => {
              const Icon = FIELD_TYPE_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => addField(type)}>
                  <Icon />
                  <span className="flex flex-col">
                    <span>{tForms(`fieldTypes.${type}`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`fieldTypeHints.${type}`)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </FieldSet>
  );

  const SubmitIcon = isEditing ? SendIcon : SaveIcon;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t("editTitle") : t("addTitle")}
      description={
        isEditing
          ? t("editDescription", {
              version:
                mode.kind === "edit" ? mode.form.latestVersion.version : 0,
            })
          : t("addDescription")
      }
      closeLabel={t("cancel")}
      initialFocus={false}
      className="sm:max-w-5xl"
      footer={
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
            form={FORM_ID}
            isLoading={isSaving && publishStep === null}
          >
            <SubmitIcon data-icon="inline-start" />
            {isEditing ? t("saveEdit") : t("saveCreate")}
          </Button>
        </DialogFooter>
      }
    >
      <form
        id={FORM_ID}
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        {settings}

        <ToggleGroup
          aria-label={t("viewLabel")}
          value={[ui.view]}
          onValueChange={(next) => {
            const view = next[0];
            if (view === "build" || view === "preview") {
              setUi((current) => ({ ...current, view }));
            }
          }}
          variant="outline"
          spacing={0}
          className="grid w-full grid-cols-2 lg:hidden"
        >
          <ToggleGroupItem value="build">{t("viewBuild")}</ToggleGroupItem>
          <ToggleGroupItem value="preview">{t("viewPreview")}</ToggleGroupItem>
        </ToggleGroup>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className={cn(ui.view === "preview" && "max-lg:hidden")}>
            {fieldList}
          </div>
          <div
            className={cn(
              "flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start",
              ui.view === "build" && "max-lg:hidden",
            )}
          >
            <p className="text-sm font-medium max-lg:hidden">
              {t("viewPreview")}
            </p>
            <FormPreview definition={previewDefinition} />
          </div>
        </div>
      </form>

      <PublishDialog
        step={publishStep}
        unitsByField={previousUnits}
        isPublishing={isSaving}
        onCancel={() => setPublishStep(null)}
        onConfirm={handlePublish}
      />
    </ResponsiveFormDialog>
  );
}
