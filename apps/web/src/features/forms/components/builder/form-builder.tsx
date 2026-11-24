"use client";

import {
  API_ERROR_CODE,
  CORRECTIVE_ACTION_MODE,
  getMeasurementFields,
  type FieldType,
  type FormResponse,
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
  Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MobileHeaderTitle } from "@/components/layout/shell-slots";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { useCorrectiveSeed } from "../../hooks/use-corrective-seed";
import { useFormsMutations } from "../../hooks/use-forms-mutations";
import {
  BUILDER_LIMITS,
  chooseCategory,
  correctiveOn,
  createBuilderField,
  duplicateField,
  failRules,
  hasBuilderIssues,
  insertField,
  insertFieldAt,
  moveField,
  moveFieldTo,
  sameBuilderState,
  sameDefinition,
  toBuilderState,
  toDefinition,
  validateBuilder,
  type BuilderField,
  type BuilderState,
} from "../../lib/form-builder";
import { decimalSeparator } from "../../lib/measurement";
import { BuilderCanvas, BuilderDnd, DropSlot } from "./builder-dnd";
import { BuilderInspector, type BuilderSelection } from "./builder-inspector";
import { CorrectiveCard } from "./corrective-card";
import { CorrectiveEditor } from "./corrective-editor";
import { FieldCard } from "./field-card";
import { FieldSettings } from "./field-editor";
import { AddFieldRow, FieldPalette, FieldTypeList } from "./field-palette";
import { FormCard } from "./form-card";
import { FormPreview } from "./form-preview";
import { FormSettingsFields } from "./form-settings-fields";
import { MobileFieldList } from "./mobile-field-list";
import { PublishDialog, type PublishStep } from "./publish-dialog";

const ID_PREFIX = "form-builder";
const FORMS_PATH = "/dashboard/forms";
// The count only earns header space once the limit is close enough to matter.
const NEAR_FIELD_LIMIT = BUILDER_LIMITS.maxFields - 10;

export type FormBuilderMode =
  | { kind: "create"; initial: BuilderState; onBack?: () => void }
  | { kind: "edit"; form: FormResponse };

type View = "build" | "preview";
type Sheet = BuilderSelection["kind"] | "add";

function initialState(mode: FormBuilderMode, separator: string): BuilderState {
  if (mode.kind === "create") return mode.initial;
  return toBuilderState(
    {
      name: mode.form.name,
      category: mode.form.category,
      appliesTo: mode.form.appliesTo,
      onDemand: mode.form.onDemand,
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
  const seed = useCorrectiveSeed();
  const { create, update, publishVersion } = useFormsMutations();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);

  const [saved, setSaved] = useState(() => initialState(mode, separator));
  const [builder, setBuilder] = useState(saved);
  const [formId, setFormId] = useState(
    mode.kind === "edit" ? mode.form.id : null,
  );
  const [publishedVersion, setPublishedVersion] = useState<number | null>(
    mode.kind === "edit" ? mode.form.latestVersion.version : null,
  );
  // A blank form opens on its details with the cursor in the name; anything else on its first field.
  const [startsBlank] = useState(() => saved.fields.length === 0);
  const [selection, setSelection] = useState<BuilderSelection>(() =>
    saved.fields[0]
      ? { kind: "field", id: saved.fields[0].id }
      : { kind: "form" },
  );
  const [sheet, setSheet] = useState<Sheet | null>(startsBlank ? "form" : null);
  const [view, setView] = useState<View>("build");
  const [showIssues, setShowIssues] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [publishStep, setPublishStep] = useState<PublishStep | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const issues = validateBuilder(builder);
  const hasIssues = hasBuilderIssues(issues);
  const shownIssues = showIssues ? issues : null;
  const formHasIssues = Boolean(
    issues.name || issues.category || issues.appliesTo,
  );
  const issueCount =
    Object.keys(issues.byField).length +
    (formHasIssues ? 1 : 0) +
    (issues.fields ? 1 : 0) +
    (issues.correctiveLabels ? 1 : 0);
  const isDirty = !sameBuilderState(builder, saved);
  const definition = useMemo(() => toDefinition(builder), [builder]);
  const savedDefinition = useMemo(() => toDefinition(saved), [saved]);
  const definitionChanged =
    publishedVersion === null || !sameDefinition(definition, savedDefinition);
  const rules = useMemo(() => failRules(builder.fields), [builder.fields]);
  const hasCorrective = correctiveOn(builder);

  const selectedIndex =
    selection.kind === "field"
      ? builder.fields.findIndex((f) => f.id === selection.id)
      : -1;
  const selected = selectedIndex === -1 ? null : builder.fields[selectedIndex]!;
  const publishedMeasurementIds = useMemo(
    () =>
      new Set(
        publishedVersion === null
          ? []
          : getMeasurementFields(savedDefinition).map((field) => field.id),
      ),
    [publishedVersion, savedDefinition],
  );
  const selectedParameterLocked = selected
    ? publishedMeasurementIds.has(selected.id)
    : false;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Arrow keys move the selected field, unless focus is in a control that uses them itself.
  useEffect(() => {
    if (isMobile || view !== "build" || selection.kind !== "field") return;
    const fieldId = selection.id;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const card = target?.closest<HTMLElement>("[data-field-select]");
      if (target !== document.body && !card) return;
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -1 : 1;
      setBuilder((current) => ({
        ...current,
        fields: moveField(
          current.fields,
          current.fields.findIndex((f) => f.id === fieldId),
          delta,
        ),
      }));
      // Reordering moves the card's node, which drops focus; keep it for the next press.
      if (card) requestAnimationFrame(() => card.focus());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, view, selection]);

  function patch(next: Partial<BuilderState>) {
    const { category, ...rest } = next;
    setBuilder((current) => {
      const merged = { ...current, ...rest };
      return category
        ? chooseCategory(merged, category, seed(category))
        : merged;
    });
    if (next.name !== undefined) setNameTaken(false);
  }

  function setFields(update: (fields: BuilderField[]) => BuilderField[]) {
    setBuilder((current) => ({ ...current, fields: update(current.fields) }));
  }

  /** Desktop shows the selection in the inspector; a phone opens it in a sheet. */
  function open(next: BuilderSelection) {
    setSelection(next);
    if (isMobile) setSheet(next.kind);
  }

  function addField(type: FieldType, placement: "below" | "end" | number) {
    if (builder.fields.length >= BUILDER_LIMITS.maxFields) return;
    const field = createBuilderField(
      type,
      new Set(builder.fields.map((existing) => existing.id)),
      { optionLabels: [tForms("answers.yes"), tForms("answers.no")] },
    );
    const afterId =
      placement === "below" && selection.kind === "field" ? selection.id : null;
    setFields((fields) =>
      typeof placement === "number"
        ? insertFieldAt(fields, placement, field)
        : insertField(fields, afterId, field),
    );
    setView("build");
    open({ kind: "field", id: field.id });
  }

  function updateField(next: BuilderField) {
    setFields((fields) => fields.map((f) => (f.id === next.id ? next : f)));
  }

  function nudge(fieldId: string, delta: -1 | 1) {
    setFields((fields) =>
      moveField(
        fields,
        fields.findIndex((f) => f.id === fieldId),
        delta,
      ),
    );
  }

  function moveTo(fieldId: string, toIndex: number) {
    setFields((fields) => moveFieldTo(fields, fieldId, toIndex));
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
    setSelection({ kind: "field", id: copy.id });
  }

  function remove(fieldId: string) {
    const index = builder.fields.findIndex((f) => f.id === fieldId);
    const remaining = builder.fields.filter((f) => f.id !== fieldId);
    const next = remaining[Math.min(index, remaining.length - 1)];
    setFields(() => remaining);
    setSelection(next ? { kind: "field", id: next.id } : { kind: "form" });
    setSheet(null);
  }

  function toggleCorrective(on: boolean) {
    patch({
      correctiveAction: on
        ? CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
        : CORRECTIVE_ACTION_MODE.OFF,
    });
    if (!isMobile) setSelection({ kind: "corrective" });
  }

  function revealIssues() {
    setShowIssues(true);
    setView("build");
    const firstField = builder.fields.find((field) => issues.byField[field.id]);
    if (formHasIssues) open({ kind: "form" });
    else if (firstField) open({ kind: "field", id: firstField.id });
    else if (issues.correctiveLabels) open({ kind: "corrective" });
  }

  const onBack = mode.kind === "create" ? mode.onBack : undefined;
  const backLabel = onBack ? t("backToStart") : t("backToForms");

  function exit() {
    if (onBack) onBack();
    else router.push(FORMS_PATH);
  }

  function leave() {
    if (isDirty) setDiscardOpen(true);
    else exit();
  }

  const meta = () => ({
    name: builder.name.trim(),
    category: builder.category,
    appliesTo: builder.appliesTo,
    onDemand: builder.onDemand,
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
        setView("build");
        open({ kind: "form" });
        return;
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
        await update.mutateAsync({
          id: formId,
          input: { ...meta(), category, appliesTo },
        });
        return null;
      });
    }
  }

  function confirmPublish() {
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
      input.appliesTo !== saved.appliesTo ||
      input.onDemand !== saved.onDemand;

    void runSave(async () => {
      // A refused version must not leave a renamed form behind, so the version goes first.
      const published = await publishVersion.mutateAsync({
        id: formId,
        definition,
      });
      if (metaChanged) await update.mutateAsync({ id: formId, input });
      return published.latestVersion.version;
    });
  }

  const count = builder.fields.length;
  const canAdd = count < BUILDER_LIMITS.maxFields;
  const nearLimit = count >= NEAR_FIELD_LIMIT;
  const canSubmit = isDirty || publishedVersion === null;
  const submitLabel = definitionChanged ? t("publish") : t("save");
  const SubmitIcon = definitionChanged ? SendIcon : SaveIcon;
  const fieldCountText = t("fieldCountOf", {
    count,
    max: BUILDER_LIMITS.maxFields,
  });

  const formDetails = (
    <FormSettingsFields
      idPrefix={ID_PREFIX}
      state={builder}
      issues={shownIssues}
      nameTaken={nameTaken}
      autoFocusName={startsBlank}
      onPatch={patch}
    />
  );

  const correctiveEditor = (inSheet: boolean) => (
    <CorrectiveEditor
      idPrefix={ID_PREFIX}
      category={builder.category}
      corrective={builder.corrective}
      mode={builder.correctiveAction}
      blankAnswers={shownIssues?.correctiveLabels}
      inSheet={inSheet}
      onChange={(corrective) => patch({ corrective })}
      onModeChange={(correctiveAction) => patch({ correctiveAction })}
    />
  );

  const formCard = (
    <FormCard
      name={builder.name}
      category={builder.category}
      appliesTo={builder.appliesTo}
      selected={selection.kind === "form"}
      hasIssues={Boolean(shownIssues) && formHasIssues}
      compact={isMobile}
      onSelect={() => open({ kind: "form" })}
    />
  );

  const correctiveStep = (
    <>
      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="h-px flex-1 bg-foreground/15" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">
          {t("corrective.divider")}
        </span>
        <span className="h-px flex-1 bg-foreground/15" aria-hidden />
      </div>
      <CorrectiveCard
        on={hasCorrective}
        corrective={builder.corrective}
        rules={rules}
        selected={selection.kind === "corrective"}
        hasIssues={Boolean(shownIssues?.correctiveLabels)}
        compact={isMobile}
        onSelect={() => open({ kind: "corrective" })}
        onToggle={toggleCorrective}
      />
    </>
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
            className="h-8 gap-1.5 rounded-md! px-3 text-muted-foreground hover:bg-transparent aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm max-md:h-10 max-md:flex-1"
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
      className="max-md:h-11 max-md:flex-1"
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
    hasIssues && (showIssues || count > 0) ? (
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

  const dialogs = (
    <>
      <PublishDialog
        step={publishStep}
        summary={{
          formName: builder.name.trim(),
          fieldCount: count,
          appliesToLabel: builder.appliesTo
            ? tForms(`appliesTo.${builder.appliesTo}`)
            : "",
          rules,
          hasCorrective,
        }}
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
          exit();
        }}
      />
    </>
  );

  const closeSheet = (next: boolean) => {
    if (!next) setSheet(null);
  };

  if (isMobile) {
    return (
      <BuilderDnd fields={builder.fields} onMove={moveTo} onInsert={addField}>
        <div className="flex flex-col gap-4">
          <MobileHeaderTitle>
            {builder.name.trim() || t("untitledForm")}
          </MobileHeaderTitle>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={leave}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              {backLabel}
            </Button>
            {issuesButton}
          </div>
          {viewToggle}

          {view === "preview" ? (
            <FormPreview
              definition={definition}
              formName={builder.name.trim()}
            />
          ) : (
            <>
              {formCard}
              <div className="flex items-baseline justify-between px-0.5 pt-1">
                <h2 className="text-sm font-medium">{t("fieldsLabel")}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {nearLimit
                    ? fieldCountText
                    : count > 1
                      ? t("reorderHint")
                      : null}
                </span>
              </div>
              {count > 0 ? (
                <MobileFieldList
                  fields={builder.fields}
                  issues={shownIssues}
                  onOpen={(id) => open({ kind: "field", id })}
                />
              ) : (
                <p
                  className={
                    shownIssues?.fields
                      ? "rounded-xl border border-dashed border-destructive px-4 py-6 text-center text-sm text-destructive"
                      : "rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
                  }
                >
                  {shownIssues?.fields
                    ? t("errors.noFields")
                    : t("emptyCanvasMobile")}
                </p>
              )}
              {correctiveStep}
              <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t bg-background px-4 pt-3 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={!canAdd}
                  onClick={() => setSheet("add")}
                >
                  <PlusIcon data-icon="inline-start" />
                  {t("addField")}
                </Button>
                {submitButton}
              </div>
            </>
          )}

          <ResponsiveFormDialog
            open={sheet === "add"}
            onOpenChange={closeSheet}
            title={t("addFieldTitle")}
            closeLabel={t("close")}
          >
            <FieldTypeList
              canAdd={canAdd}
              onAdd={(type) => addField(type, "end")}
            />
          </ResponsiveFormDialog>

          <ResponsiveFormSheet
            open={sheet === "field" && selected !== null}
            onOpenChange={closeSheet}
            title={selected ? tForms(`fieldTypes.${selected.type}`) : ""}
            closeLabel={t("done")}
            footer={
              selected ? (
                <div className="flex w-full items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label={t("moveUp", {
                      label: selected.label || t("untitled"),
                    })}
                    disabled={selectedIndex === 0}
                    onClick={() => nudge(selected.id, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label={t("moveDown", {
                      label: selected.label || t("untitled"),
                    })}
                    disabled={selectedIndex === count - 1}
                    onClick={() => nudge(selected.id, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1"
                    onClick={() => duplicate(selected)}
                  >
                    <CopyIcon data-icon="inline-start" />
                    {t("duplicate")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-10 flex-1"
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
                parameterLocked={selectedParameterLocked}
              />
            ) : null}
          </ResponsiveFormSheet>

          <ResponsiveFormSheet
            open={sheet === "form"}
            onOpenChange={closeSheet}
            title={t("formDetails")}
            closeLabel={t("done")}
          >
            {formDetails}
          </ResponsiveFormSheet>

          <ResponsiveFormSheet
            open={sheet === "corrective"}
            onOpenChange={closeSheet}
            title={t("corrective.heading")}
            closeLabel={t("done")}
          >
            {correctiveEditor(true)}
          </ResponsiveFormSheet>

          {dialogs}
        </div>
      </BuilderDnd>
    );
  }

  return (
    <BuilderDnd fields={builder.fields} onMove={moveTo} onInsert={addField}>
      <div className="flex flex-col gap-6">
        <header className="sticky top-0 z-20 -mx-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={leave}>
              <ArrowLeftIcon data-icon="inline-start" />
              {backLabel}
            </Button>
          </div>
          {viewToggle}
          <div className="flex items-center justify-end gap-2">
            {issuesButton}
            {submitButton}
          </div>
        </header>

        {view === "preview" ? (
          <div className="@container rounded-xl bg-muted px-4 py-8">
            <FormPreview
              definition={definition}
              formName={builder.name.trim()}
            />
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
            <aside
              aria-label={t("addFieldTitle")}
              className="sticky top-20 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto xl:block"
            >
              <FieldPalette
                canAdd={canAdd}
                onAdd={(type) => addField(type, "below")}
              />
            </aside>

            <BuilderCanvas
              label={t("fieldsLabel")}
              className="flex min-w-0 flex-col gap-4 rounded-xl bg-muted p-4 sm:p-6"
            >
              {formCard}

              {builder.fields.map((field, index) => (
                <Fragment key={field.id}>
                  <DropSlot index={index} />
                  <FieldCard
                    field={field}
                    index={index}
                    count={count}
                    selected={field.id === selected?.id}
                    issues={shownIssues?.byField[field.id]}
                    onSelect={() => open({ kind: "field", id: field.id })}
                    onMove={(delta) => nudge(field.id, delta)}
                    onDuplicate={() => duplicate(field)}
                    onRemove={() => remove(field.id)}
                  />
                </Fragment>
              ))}

              <DropSlot index={count} />

              <AddFieldRow
                canAdd={canAdd}
                count={count}
                onAdd={(type) => addField(type, "end")}
              />

              {shownIssues?.fields === "empty" ? (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <CircleAlertIcon className="size-4" aria-hidden />
                  {t("errors.noFields")}
                </p>
              ) : null}

              {correctiveStep}
            </BuilderCanvas>

            <aside
              aria-label={t("inspectorLabel")}
              className="sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
            >
              <BuilderInspector
                idPrefix={ID_PREFIX}
                selection={selection}
                field={selected}
                index={selectedIndex}
                count={count}
                issues={shownIssues?.byField[selected?.id ?? ""]}
                onChange={updateField}
                parameterLocked={selectedParameterLocked}
                onDuplicate={() => selected && duplicate(selected)}
                onRemove={() => selected && remove(selected.id)}
                formDetails={formDetails}
                corrective={correctiveEditor(false)}
              />
            </aside>
          </div>
        )}

        {dialogs}
      </div>
    </BuilderDnd>
  );
}
