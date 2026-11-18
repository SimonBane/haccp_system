"use client";

import {
  API_ERROR_CODE,
  CORRECTIVE_ACTION_MODE,
  droppedOverridesDetailsSchema,
  getMeasurementFields,
  type FieldType,
  type FormResponse,
  type MeasurementUnit,
} from "@haccp/shared";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  CopyIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  Settings2Icon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MobileHeaderActions,
  MobileHeaderTitle,
} from "@/components/layout/shell-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { cn } from "@/lib/utils";
import { useFormsMutations } from "../../hooks/use-forms-mutations";
import { FIELD_TYPE_ICONS, FORM_CATEGORY_ICONS } from "../../lib/category-icon";
import {
  BUILDER_LIMITS,
  createBuilderField,
  duplicateField,
  failRules,
  hasBuilderIssues,
  insertField,
  moveField,
  sameBuilderState,
  sameDefinition,
  toBuilderState,
  toDefinition,
  validateBuilder,
  type BuilderField,
  type BuilderState,
} from "../../lib/form-builder";
import { decimalSeparator } from "../../lib/measurement";
import { FieldCard } from "./field-card";
import { FieldSettings } from "./field-editor";
import { FieldInspector, type InspectorTab } from "./field-inspector";
import { FailRulesSummary, FieldPalette, FieldTypeList } from "./field-palette";
import { FormPreview } from "./form-preview";
import { FormSettingsFields } from "./form-settings-fields";
import { MobileFieldList } from "./mobile-field-list";
import { PublishDialog, type PublishStep } from "./publish-dialog";

const ID_PREFIX = "form-builder";
const FORMS_PATH = "/dashboard/forms";

export type FormBuilderMode =
  | { kind: "create"; initial: BuilderState }
  | { kind: "edit"; form: FormResponse };

type View = "build" | "preview";

function initialState(mode: FormBuilderMode, separator: string): BuilderState {
  if (mode.kind === "create") return mode.initial;
  return toBuilderState(
    {
      name: mode.form.name,
      category: mode.form.category,
      appliesTo: mode.form.appliesTo,
      definition: mode.form.latestVersion.definition,
    },
    separator,
  );
}

export function FormBuilder({ mode }: { mode: FormBuilderMode }) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useIsMobile();
  const showApiError = useApiErrorToast();
  const { create, update, publishVersion } = useFormsMutations();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);

  const [saved, setSaved] = useState(() => initialState(mode, separator));
  const [builder, setBuilder] = useState(saved);
  const [formId, setFormId] = useState(mode.kind === "edit" ? mode.form.id : null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(
    mode.kind === "edit" ? mode.form.latestVersion.version : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => saved.fields[0]?.id ?? null,
  );
  const [tab, setTab] = useState<InspectorTab>("field");
  const [view, setView] = useState<View>("build");
  const [showIssues, setShowIssues] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [publishStep, setPublishStep] = useState<PublishStep | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [fieldSheetOpen, setFieldSheetOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);

  const issues = validateBuilder(builder);
  const hasIssues = hasBuilderIssues(issues);
  const shownIssues = showIssues ? issues : null;
  const issueCount =
    Object.keys(issues.byField).length +
    (issues.name ? 1 : 0) +
    (issues.category ? 1 : 0) +
    (issues.appliesTo ? 1 : 0) +
    (issues.fields ? 1 : 0);
  const isDirty = !sameBuilderState(builder, saved);
  const definition = useMemo(() => toDefinition(builder), [builder]);
  const savedDefinition = useMemo(() => toDefinition(saved), [saved]);
  const definitionChanged =
    publishedVersion === null || !sameDefinition(definition, savedDefinition);
  const rules = useMemo(() => failRules(builder.fields), [builder.fields]);
  const correctiveRequired =
    builder.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL;

  const selectedIndex = builder.fields.findIndex((f) => f.id === selectedId);
  const selected = selectedIndex === -1 ? null : builder.fields[selectedIndex]!;

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

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function patch(next: Partial<BuilderState>) {
    setBuilder((current) => ({ ...current, ...next }));
    if (next.name !== undefined) setNameTaken(false);
  }

  function setFields(update: (fields: BuilderField[]) => BuilderField[]) {
    setBuilder((current) => ({ ...current, fields: update(current.fields) }));
  }

  function select(fieldId: string) {
    setSelectedId(fieldId);
    setTab("field");
    if (isMobile) setFieldSheetOpen(true);
  }

  function addField(type: FieldType) {
    const field = createBuilderField(
      type,
      new Set(builder.fields.map((existing) => existing.id)),
      { optionLabels: [tForms("answers.yes"), tForms("answers.no")] },
    );
    setFields((fields) => insertField(fields, selectedId, field));
    setAddSheetOpen(false);
    setView("build");
    select(field.id);
  }

  function updateField(next: BuilderField) {
    setFields((fields) => fields.map((f) => (f.id === next.id ? next : f)));
  }

  function moveSelected(fieldId: string, delta: -1 | 1) {
    setFields((fields) =>
      moveField(fields, fields.findIndex((f) => f.id === fieldId), delta),
    );
  }

  function duplicate(field: BuilderField) {
    const label = field.label.trim()
      ? t("copyLabel", { label: field.label.trim() })
      : "";
    const copy = duplicateField(
      field,
      new Set(builder.fields.map((f) => f.id)),
      label,
    );
    setFields((fields) => insertField(fields, field.id, copy));
    setSelectedId(copy.id);
    setTab("field");
  }

  function remove(fieldId: string) {
    const index = builder.fields.findIndex((f) => f.id === fieldId);
    const remaining = builder.fields.filter((f) => f.id !== fieldId);
    setFields(() => remaining);
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    setFieldSheetOpen(false);
  }

  function revealIssues() {
    setShowIssues(true);
    setView("build");
    const firstField = Object.keys(issues.byField)[0];
    if (issues.name || issues.category || issues.appliesTo) {
      setTab("form");
      if (isMobile) setSettingsSheetOpen(true);
    } else if (firstField) {
      select(firstField);
    }
  }

  function leave() {
    if (isDirty) setDiscardOpen(true);
    else router.push(FORMS_PATH);
  }

  const meta = () => ({
    name: builder.name.trim(),
    category: builder.category,
    appliesTo: builder.appliesTo,
  });

  async function runSave(action: () => Promise<number | null>) {
    setIsSaving(true);
    try {
      const version = await action();
      setSaved(builder);
      if (version === null) {
        setPublishStep(null);
        toast.success(t("toast.updated"));
      } else {
        setPublishedVersion(version);
        setPublishStep({ kind: "done", version });
      }
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.FORM_NAME_EXISTS
      ) {
        setPublishStep(null);
        setNameTaken(true);
        setTab("form");
        setView("build");
        if (isMobile) setSettingsSheetOpen(true);
        return;
      }

      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES &&
        publishedVersion !== null
      ) {
        const details = droppedOverridesDetailsSchema.safeParse(error.details);
        if (details.success) {
          setPublishStep({
            kind: "drops",
            nextVersion: publishedVersion + 1,
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

  function handlePublish() {
    if (hasIssues) {
      revealIssues();
      return;
    }
    const { category, appliesTo } = builder;
    if (category === "" || appliesTo === "") return;

    if (definitionChanged) {
      setPublishStep({
        kind: "confirm",
        nextVersion: (publishedVersion ?? 0) + 1,
      });
      return;
    }

    if (formId) {
      void runSave(async () => {
        await update.mutateAsync({ id: formId, input: { ...meta(), category, appliesTo } });
        return null;
      });
    }
  }

  function confirmPublish(step: Exclude<PublishStep, { kind: "done" }>) {
    const { category, appliesTo } = builder;
    if (category === "" || appliesTo === "") return;
    const input = { ...meta(), category, appliesTo };

    if (formId === null) {
      void runSave(async () => {
        const created = await create.mutateAsync({ ...input, definition });
        setFormId(created.id);
        return created.latestVersion.version;
      });
      return;
    }

    const metaChanged =
      input.name !== saved.name.trim() ||
      input.category !== saved.category ||
      input.appliesTo !== saved.appliesTo;

    void runSave(async () => {
      // A refused version must not leave a renamed form behind, so the version goes first.
      const published = await publishVersion.mutateAsync({
        id: formId,
        definition,
        confirmDroppedOverrides: step.kind === "drops",
      });
      if (metaChanged) await update.mutateAsync({ id: formId, input });
      return published.latestVersion.version;
    });
  }

  const canAdd = builder.fields.length < BUILDER_LIMITS.maxFields;
  const canSubmit = isDirty || publishedVersion === null;
  const submitLabel = definitionChanged ? t("publish") : t("save");
  const SubmitIcon = definitionChanged ? SendIcon : SaveIcon;
  const CategoryIcon = builder.category ? FORM_CATEGORY_ICONS[builder.category] : null;

  const formSettings = (
    <FormSettingsFields
      idPrefix={ID_PREFIX}
      state={builder}
      issues={shownIssues}
      nameTaken={nameTaken}
      publishedVersion={publishedVersion}
      onPatch={patch}
    />
  );

  const viewToggle = (
    <ToggleGroup
      aria-label={t("modeLabel")}
      value={[view]}
      onValueChange={(next) => {
        const value = next[0];
        if (value === "build" || value === "preview") setView(value);
      }}
      spacing={0}
      className="rounded-lg bg-muted p-[3px] max-md:w-full"
    >
      {(["build", "preview"] as const).map((value) => {
        const Icon = value === "build" ? PencilIcon : EyeIcon;
        return (
          <ToggleGroupItem
            key={value}
            value={value}
            className="h-8 gap-1.5 rounded-md! px-3 text-muted-foreground hover:bg-transparent aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm max-md:flex-1"
          >
            <Icon aria-hidden />
            {t(value === "build" ? "modeBuild" : "modePreview")}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );

  const submitButton = (
    <Button
      type="button"
      className="max-md:flex-1"
      disabled={!canSubmit}
      isLoading={isSaving && publishStep === null}
      onClick={handlePublish}
      data-testid="form-builder-submit"
    >
      <SubmitIcon data-icon="inline-start" />
      {submitLabel}
    </Button>
  );

  const issuesButton =
    hasIssues && (showIssues || builder.fields.length > 0) ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={revealIssues}
      >
        <CircleAlertIcon data-icon="inline-start" />
        {t("issues", { count: issueCount })}
      </Button>
    ) : null;

  const metaBadges = (
    <div className="flex flex-wrap gap-1.5">
      {CategoryIcon && builder.category ? (
        <Badge variant="outline">
          <CategoryIcon aria-hidden />
          {tForms(`categories.${builder.category}`)}
        </Badge>
      ) : null}
      {builder.appliesTo ? (
        <Badge variant="outline">{tForms(`appliesTo.${builder.appliesTo}`)}</Badge>
      ) : null}
      {correctiveRequired ? (
        <Badge variant="outline">
          <ShieldCheckIcon aria-hidden />
          {t("correctiveBadge")}
        </Badge>
      ) : null}
    </div>
  );

  const dialogs = (
    <>
      <PublishDialog
        step={publishStep}
        summary={{
          formName: builder.name.trim(),
          fieldCount: builder.fields.length,
          appliesToLabel: builder.appliesTo
            ? tForms(`appliesTo.${builder.appliesTo}`)
            : "",
          rules,
          correctiveRequired,
        }}
        unitsByField={previousUnits}
        isPublishing={isSaving}
        onCancel={() => {
          if (publishStep?.kind === "done") router.push(FORMS_PATH);
          setPublishStep(null);
        }}
        onConfirm={confirmPublish}
      />
      <ResponsiveAlertDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t("discardTitle")}
        description={t("discardDescription")}
        cancelLabel={t("discardCancel")}
        confirmLabel={t("discardConfirm")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        onConfirm={() => {
          setDiscardOpen(false);
          router.push(FORMS_PATH);
        }}
      />
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        <MobileHeaderTitle>{builder.name.trim() || t("untitledForm")}</MobileHeaderTitle>
        <MobileHeaderActions>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={t("formSettings")}
            onClick={() => setSettingsSheetOpen(true)}
          >
            <Settings2Icon className="size-5" />
          </Button>
        </MobileHeaderActions>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={leave}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backToForms")}
          </Button>
          {issuesButton}
        </div>
        {viewToggle}

        {view === "preview" ? (
          <FormPreview definition={definition} formName={builder.name.trim()} />
        ) : (
          <>
            {metaBadges}
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">{t("fieldsLabel")}</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("fieldCountOf", {
                  count: builder.fields.length,
                  max: BUILDER_LIMITS.maxFields,
                })}
              </span>
            </div>
            {builder.fields.length > 0 ? (
              <MobileFieldList
                fields={builder.fields}
                issues={shownIssues}
                onOpen={select}
              />
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t("emptyCanvas")}
              </p>
            )}
            <div className="rounded-xl bg-muted p-4">
              <FailRulesSummary rules={rules} correctiveRequired={correctiveRequired} />
            </div>
            <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background px-4 pt-3 pb-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={!canAdd}
                onClick={() => setAddSheetOpen(true)}
              >
                <PlusIcon data-icon="inline-start" />
                {t("addField")}
              </Button>
              {submitButton}
            </div>
          </>
        )}

        <ResponsiveFormDialog
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          title={t("addFieldTitle")}
          closeLabel={t("close")}
        >
          <FieldTypeList canAdd={canAdd} onAdd={addField} />
        </ResponsiveFormDialog>

        <ResponsiveFormSheet
          open={fieldSheetOpen && selected !== null}
          onOpenChange={setFieldSheetOpen}
          title={selected ? tForms(`fieldTypes.${selected.type}`) : ""}
          closeLabel={t("done")}
          footer={
            selected ? (
              <div className="flex w-full items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("moveUp", { label: selected.label || t("untitled") })}
                  disabled={selectedIndex === 0}
                  onClick={() => moveSelected(selected.id, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("moveDown", { label: selected.label || t("untitled") })}
                  disabled={selectedIndex === builder.fields.length - 1}
                  onClick={() => moveSelected(selected.id, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => duplicate(selected)}
                >
                  <CopyIcon data-icon="inline-start" />
                  {t("duplicate")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => remove(selected.id)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {t("deleteField")}
                </Button>
              </div>
            ) : null
          }
        >
          {selected ? (
            <FieldSettings
              idPrefix={ID_PREFIX}
              field={selected}
              issues={shownIssues?.byField[selected.id]}
              onChange={updateField}
            />
          ) : null}
        </ResponsiveFormSheet>

        <ResponsiveFormSheet
          open={settingsSheetOpen}
          onOpenChange={setSettingsSheetOpen}
          title={t("formSettings")}
          closeLabel={t("done")}
        >
          {formSettings}
        </ResponsiveFormSheet>

        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-20 -mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={leave}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("backToForms")}
          </Button>
          <span className="h-6 w-px bg-border" aria-hidden />
          <h1 className="truncate font-semibold">
            {builder.name.trim() || t("untitledForm")}
          </h1>
          {publishedVersion !== null ? (
            <Badge variant="secondary" className="tabular-nums">
              {t("versionBadge", { version: publishedVersion })}
            </Badge>
          ) : null}
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums max-xl:hidden">
            {t("fieldCountOf", {
              count: builder.fields.length,
              max: BUILDER_LIMITS.maxFields,
            })}
          </span>
        </div>
        {viewToggle}
        <div className="flex items-center justify-end gap-2">
          {issuesButton}
          {submitButton}
        </div>
      </header>

      {view === "preview" ? (
        <div className="rounded-xl bg-muted px-4 py-8">
          <FormPreview definition={definition} formName={builder.name.trim()} />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
          <aside
            aria-label={t("addFieldTitle")}
            className="sticky top-20 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto xl:block"
          >
            <FieldPalette
              canAdd={canAdd}
              onAdd={addField}
              rules={rules}
              correctiveRequired={correctiveRequired}
            />
          </aside>

          <section
            aria-label={t("fieldsLabel")}
            className="flex min-w-0 flex-col gap-4 rounded-xl bg-muted p-4 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 rounded-xl bg-card px-6 py-5 shadow-xs ring-1 ring-foreground/10">
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="truncate text-lg font-medium">
                  {builder.name.trim() || t("untitledForm")}
                </h2>
                {metaBadges}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTab("form")}
              >
                <Settings2Icon data-icon="inline-start" />
                {t("formSettings")}
              </Button>
            </div>

            {builder.fields.map((field, index) => (
              <FieldCard
                key={field.id}
                field={field}
                index={index}
                count={builder.fields.length}
                selected={field.id === selectedId}
                issues={shownIssues?.byField[field.id]}
                onSelect={() => select(field.id)}
                onMove={(delta) => moveSelected(field.id, delta)}
                onDuplicate={() => duplicate(field)}
                onRemove={() => remove(field.id)}
              />
            ))}

            {shownIssues?.fields === "empty" ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlertIcon className="size-4" aria-hidden />
                {t("errors.noFields")}
              </p>
            ) : null}

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-foreground/25 bg-background/60 p-4",
                builder.fields.length === 0 && "py-8",
              )}
            >
              <span className="text-sm text-muted-foreground">
                {builder.fields.length === 0 ? t("emptyCanvas") : t("addField")}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(["measurement", "checkbox", "choice", "text", "date"] as const).map(
                  (type) => {
                    const Icon = FIELD_TYPE_ICONS[type];
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canAdd}
                        onClick={() => addField(type)}
                      >
                        <Icon data-icon="inline-start" />
                        {tForms(`fieldTypes.${type}`)}
                      </Button>
                    );
                  },
                )}
              </div>
            </div>
          </section>

          <aside
            aria-label={t("inspectorLabel")}
            className="sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
          >
            <FieldInspector
              idPrefix={ID_PREFIX}
              tab={tab}
              onTabChange={setTab}
              field={selected}
              index={selectedIndex}
              count={builder.fields.length}
              issues={shownIssues?.byField[selected?.id ?? ""]}
              onChange={updateField}
              onDuplicate={() => selected && duplicate(selected)}
              onRemove={() => selected && remove(selected.id)}
              formSettings={formSettings}
            />
          </aside>
        </div>
      )}

      {dialogs}
    </div>
  );
}
