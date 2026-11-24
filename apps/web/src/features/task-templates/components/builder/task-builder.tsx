"use client";

import {
  API_ERROR_CODE,
  FORM_APPLIES_TO,
  getMeasurementFields,
  targetDisplayName,
  sortWeekdays,
  type FormListItem,
  type TargetInput,
  type TargetResponse,
  type TaskTemplateFieldsInput,
  type TaskTemplateResponse,
} from "@haccp/shared";
import { ArrowLeftIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MobileHeaderActions,
  MobileHeaderTitle,
} from "@/components/layout/shell-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { Switch } from "@/components/ui/switch";
import { useFormsQuery } from "@/features/forms/hooks/use-forms-query";
import { useTargetsMutations } from "@/features/targets/hooks/use-targets-mutations";
import { useTargetsQuery } from "@/features/targets/hooks/use-targets-query";
import {
  BuilderSection,
  MobileBuilderSection,
} from "@/features/task-templates/components/builder/builder-section";
import { BuilderPreview } from "@/features/task-templates/components/builder/builder-preview";
import {
  FormPicker,
  MobileFormPicker,
} from "@/features/task-templates/components/builder/form-picker";
import {
  DayStrip,
  HOUR_MARKS,
  HourRuler,
} from "@/features/task-templates/components/day-timeline";
import { SelectedTargets } from "@/features/task-templates/components/builder/selected-targets";
import {
  TargetPicker,
  type CreateTargetResult,
} from "@/features/task-templates/components/builder/target-picker";
import { WhenFields } from "@/features/task-templates/components/builder/when-fields";
import { WindowFields } from "@/features/task-templates/components/builder/window-fields";
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import { useTaskTemplatesMutations } from "@/features/task-templates/hooks/use-task-templates-mutations";
import {
  applyTargetSelection,
  hasTaskChanges,
} from "@/features/task-templates/lib/form-helpers";
import {
  SECTION_OF,
  builderSections,
  draftFromTask,
  draftTimes,
  draftWindow,
  draftWindowFields,
  emptyDraft,
  missingSteps,
  type BuilderSection as Section,
  type TaskDraft,
} from "@/features/task-templates/lib/task-draft";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

const ID = "task-builder";
const TASKS_PATH = "/dashboard/task-templates";

export type TaskBuilderMode =
  | { kind: "create"; duplicateOf: TaskTemplateResponse | null }
  | { kind: "edit"; task: TaskTemplateResponse };

type TaskBuilderProps = {
  mode: TaskBuilderMode;
  initialForms: FormListItem[];
  initialTargets: TargetResponse[];
  initialLocationId: string;
};

function initialDraft(mode: TaskBuilderMode): TaskDraft {
  if (mode.kind === "edit") return draftFromTask(mode.task);
  if (mode.duplicateOf) {
    return draftFromTask(mode.duplicateOf);
  }
  return emptyDraft();
}

export function TaskBuilder({
  mode,
  initialForms,
  initialTargets,
  initialLocationId,
}: TaskBuilderProps) {
  const t = useTranslations("TasksPage");
  const tb = useTranslations("TasksPage.builder");
  const router = useRouter();
  const isMobile = useIsMobile();
  const showApiError = useApiErrorToast();
  const labels = useScheduleLabels();
  const { location } = useLocation();

  const { data: forms = [] } = useFormsQuery({ initialData: initialForms });
  const { data: queriedTargets = [] } = useTargetsQuery({
    initialData: initialTargets,
    initialLocationId,
  });
  const targetMutations = useTargetsMutations();
  const { create, update } = useTaskTemplatesMutations();

  const [saved] = useState(() => initialDraft(mode));
  const [draft, setDraft] = useState(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<Section | null>(
    mode.kind === "edit" ? null : "form",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [created, setCreated] = useState<TargetResponse[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const targets = useMemo(() => {
    const known = new Set(queriedTargets.map((target) => target.id));
    return [...queriedTargets, ...created.filter((target) => !known.has(target.id))];
  }, [queriedTargets, created]);
  const names = useMemo(() => {
    const byId = new Map(targets.map((target) => [target.id, target]));
    return new Map(
      targets.map((target) => [
        target.id,
        targetDisplayName(target, target.parentId ? byId.get(target.parentId)?.name : null),
      ]),
    );
  }, [targets]);

  const form = forms.find((candidate) => candidate.id === draft.formId) ?? null;
  const appliesTo = form?.appliesTo ?? null;
  const sections = builderSections(appliesTo);
  const hasTargetsStep = sections.includes("targets");
  const isLocationForm = Boolean(form) && !hasTargetsStep;
  const stepOf = (section: Section) => sections.indexOf(section) + 1;
  const eligibleIds = new Set(targets.map((target) => target.id));
  const selections = draft.targets.filter((selection) => eligibleIds.has(selection.targetId));
  const selectedIds = selections.map((selection) => selection.targetId);
  const measurementFields = form ? getMeasurementFields(form.latestVersion.definition) : [];
  const times = draftTimes(draft);
  const itemCount = isLocationForm ? 1 : selections.length;
  const checksPerDay = times.length * itemCount;
  const missing = missingSteps(draft, appliesTo, eligibleIds);
  const isMissing = (step: (typeof missing)[number]) => showErrors && missing.includes(step);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const itemsText = isLocationForm
    ? t("wholeLocation")
    : appliesTo
      ? t("itemCount", { count: selections.length })
      : "";
  const targetNames = isLocationForm
    ? [t("wholeLocation")]
    : selectedIds.map((id) => names.get(id) ?? "");

  const done = {
    form: !missing.includes("form"),
    targets: Boolean(form) && !missing.includes("targets"),
    when: !missing.includes("days") && !missing.includes("times"),
  };
  const doneCount = [done.form, hasTargetsStep && done.targets, done.when].filter(Boolean).length;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function patch(next: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function pickForm(next: FormListItem) {
    setDraft((current) => ({
      ...current,
      formId: next.id,
      targets: next.appliesTo === FORM_APPLIES_TO.LOCATION ? [] : current.targets,
    }));
  }

  function setSelected(ids: string[]) {
    patch({ targets: applyTargetSelection(ids) });
  }

  async function createTarget(input: TargetInput): Promise<CreateTargetResult> {
    try {
      const target = await targetMutations.create.mutateAsync(input);
      setCreated((current) => [...current, target]);
      setDraft((current) => ({
        ...current,
        targets: [...current.targets, { targetId: target.id }],
      }));
      return { kind: "created", target };
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === API_ERROR_CODE.TARGET_NAME_EXISTS) {
        return { kind: "taken" };
      }
      showApiError(error);
      return { kind: "failed" };
    }
  }

  function leave() {
    if (isDirty) setDiscardOpen(true);
    else router.push(TASKS_PATH);
  }

  async function save() {
    if (missing.length > 0 || !form) {
      setShowErrors(true);
      const first = missing[0];
      if (first) setOpenSection(SECTION_OF[first]);
      return;
    }
    const payload: TaskTemplateFieldsInput = {
      formId: form.id,
      weekdays: sortWeekdays(draft.weekdays),
      scheduledTimes: times,
      targets: isLocationForm
        ? []
        : selections.map(({ targetId }) => ({ targetId })),
      ...draftWindowFields(draft),
    };

    if (mode.kind === "edit" && !hasTaskChanges(payload, mode.task)) {
      router.push(TASKS_PATH);
      return;
    }

    setIsSaving(true);
    try {
      const result =
        mode.kind === "edit"
          ? await update.mutateAsync({ id: mode.task.id, input: payload })
          : await create.mutateAsync(payload);
      toast.success(
        mode.kind === "edit"
          ? t("toast.updateSuccess")
          : mode.duplicateOf
            ? t("toast.duplicateSuccess")
            : t("toast.createSuccess"),
      );
      setDraft(saved);
      router.push(`${TASKS_PATH}?saved=${result.id}`);
    } catch (error) {
      setIsSaving(false);
      showApiError(error);
    }
  }

  const pageTitle =
    mode.kind === "edit"
      ? tb("editTitle")
      : mode.duplicateOf
        ? tb("duplicateTitle")
        : tb("newTitle");
  const formPicker = (
    <>
      <div className="flex max-w-md flex-col gap-2">
        <span id={`${ID}-form-field`} className="text-sm leading-none font-medium">
          {tb("form.label")}
        </span>
        {isMobile ? (
          <MobileFormPicker
            id={`${ID}-form`}
            labelId={`${ID}-form-field`}
            forms={forms}
            value={draft.formId}
            onChange={pickForm}
            invalid={isMissing("form")}
          />
        ) : (
          <FormPicker
            id={`${ID}-form`}
            labelId={`${ID}-form-field`}
            forms={forms}
            value={draft.formId}
            onChange={pickForm}
            invalid={isMissing("form")}
          />
        )}
      </div>
      {forms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tb("form.noForms")}{" "}
          <Link href="/dashboard/forms/new" className="underline">
            {tb("form.createForm")}
          </Link>
        </p>
      ) : null}
      {isMissing("form") ? (
        <p role="alert" className="text-sm text-destructive">
          {tb("form.required")}
        </p>
      ) : null}
    </>
  );

  const selectedList =
    appliesTo && !isLocationForm ? (
      <SelectedTargets
        idPrefix={ID}
        targets={targets}
        selections={selections}
        fields={measurementFields}
        onRemove={(id) => setSelected(selectedIds.filter((value) => value !== id))}
        layout={isMobile ? "mobile" : "desktop"}
      />
    ) : null;

  const targetsRequired = isMissing("targets") && appliesTo && !isLocationForm ? (
    <p role="alert" className="text-sm text-destructive">
      {tb("targets.required")}
    </p>
  ) : null;

  const picker =
    appliesTo && !isLocationForm ? (
      <TargetPicker
        idPrefix={ID}
        targets={targets}
        selectedIds={selectedIds}
        onToggle={(id) =>
          setSelected(
            selectedIds.includes(id)
              ? selectedIds.filter((value) => value !== id)
              : [...selectedIds, id],
          )
        }
        onSetMany={(ids, select) =>
          setSelected(
            select
              ? [...selectedIds, ...ids.filter((id) => !selectedIds.includes(id))]
              : selectedIds.filter((id) => !ids.includes(id)),
          )
        }
        onCreate={createTarget}
        layout={isMobile ? "sheet" : "popover"}
      />
    ) : null;

  const windowSwitch = (
    <Switch
      id={`${ID}-window`}
      checked={draft.windowOn}
      aria-label={isMobile ? undefined : tb("window.switchLabel")}
      onCheckedChange={(windowOn) => patch({ windowOn })}
    />
  );

  const dialogs = (
    <ResponsiveAlertDialog
      open={discardOpen}
      onOpenChange={setDiscardOpen}
      title={tb("discard.title")}
      description={tb("discard.description")}
      cancelLabel={tb("discard.cancel")}
      confirmLabel={tb("discard.confirm")}
      confirmIcon={<Trash2Icon data-icon="inline-start" />}
      onConfirm={() => {
        setDiscardOpen(false);
        setDraft(saved);
        router.push(TASKS_PATH);
      }}
    />
  );

  if (isMobile) {
    const toggle = (section: Section) =>
      setOpenSection((current) => (current === section ? null : section));
    const next = (section: Section) =>
      setOpenSection(sections[sections.indexOf(section) + 1] ?? null);
    const sectionInvalid = (section: Section) =>
      showErrors && missing.some((step) => SECTION_OF[step] === section);
    const continueButton = (section: Section) => (
      <Button type="button" variant="secondary" className="h-11 w-full" onClick={() => next(section)}>
        {tb("continue")}
      </Button>
    );

    return (
      <div className="flex flex-1 flex-col gap-3">
        <MobileHeaderTitle>{pageTitle}</MobileHeaderTitle>
        <MobileHeaderActions>
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {tb("progress", { done: doneCount, total: sections.length - 1 })}
          </span>
          <Button type="button" variant="ghost" size="icon-lg" aria-label={tb("close")} onClick={leave}>
            <XIcon className="size-5" />
          </Button>
        </MobileHeaderActions>

        <MobileBuilderSection
          id={`${ID}-form`}
          step={1}
          done={done.form}
          doneLabel={tb("stepDone")}
          title={tb("form.mobileTitle")}
          summary={form ? form.name : tb("preview.notChosen")}
          summaryInvalid={sectionInvalid("form")}
          open={openSection === "form"}
          onToggle={() => toggle("form")}
        >
          <p id={`${ID}-form-label`} className="text-sm text-muted-foreground">
            {tb("form.mobileDescription")}
          </p>
          {formPicker}
          {continueButton("form")}
        </MobileBuilderSection>

        {hasTargetsStep ? (
          <MobileBuilderSection
            id={`${ID}-targets`}
            step={stepOf("targets")}
            done={done.targets}
            doneLabel={tb("stepDone")}
            title={tb("targets.mobileTitle")}
            summary={
              !form
                ? tb("preview.chooseFormFirst")
                : selections.length
                  ? `${itemsText} · ${targetNames.slice(0, 2).join(", ")}${targetNames.length > 2 ? ` +${targetNames.length - 2}` : ""}`
                  : tb("preview.notChosen")
            }
            summaryInvalid={sectionInvalid("targets")}
            open={openSection === "targets"}
            onToggle={() => toggle("targets")}
          >
            {!form ? (
              <p className="text-sm text-muted-foreground">{tb("targets.descriptionNone")}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{tb("targets.descriptionPick")}</p>
                {selectedList}
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setSheetOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {tb("targets.add")}
                </Button>
                {targetsRequired}
              </>
            )}
            {continueButton("targets")}
          </MobileBuilderSection>
        ) : null}

        <MobileBuilderSection
          id={`${ID}-when`}
          step={stepOf("when")}
          done={done.when}
          doneLabel={tb("stepDone")}
          title={tb("when.mobileTitle")}
          summary={
            draft.weekdays.length
              ? `${labels.days(draft.weekdays)} · ${times.length ? labels.times(times, 3) : tb("preview.noTimes")}`
              : tb("preview.noDays")
          }
          summaryInvalid={sectionInvalid("when")}
          open={openSection === "when"}
          onToggle={() => toggle("when")}
        >
          <WhenFields
            idPrefix={ID}
            draft={draft}
            onChange={patch}
            daysError={isMissing("days")}
            timesError={isMissing("times")}
            layout="mobile"
          />
          <MobileGlance times={times} window={draftWindow(draft)} />
          {continueButton("when")}
        </MobileBuilderSection>

        <MobileBuilderSection
          id={`${ID}-window`}
          step={stepOf("window")}
          done={false}
          doneLabel={tb("stepDone")}
          title={tb("window.title")}
          titleExtra={<Badge variant="outline">{tb("window.optional")}</Badge>}
          summary={draft.windowOn ? labels.window(draftWindow(draft)) : tb("window.summaryOff")}
          summaryInvalid={false}
          open={openSection === "window"}
          onToggle={() => toggle("window")}
        >
          <div className="flex items-center gap-3 rounded-xl border px-3.5 py-3">
            <label htmlFor={`${ID}-window`} className="flex flex-1 cursor-pointer flex-col gap-0.5">
              <span className="text-sm font-medium">{tb("window.mobileSwitch")}</span>
              <span className="text-[13px] text-muted-foreground">
                {draft.windowOn ? tb("window.mobileOn") : tb("window.mobileOff")}
              </span>
            </label>
            {windowSwitch}
          </div>
          <WindowFields idPrefix={ID} draft={draft} times={times} onChange={patch} layout="mobile" />
          {draft.windowOn ? <MobileGlance times={times} window={draftWindow(draft)} /> : null}
        </MobileBuilderSection>

        {showErrors && missing.length > 0 ? (
          <div role="alert" className="flex flex-col gap-1 rounded-xl bg-destructive/10 px-3.5 py-3 text-destructive">
            <span className="text-sm font-semibold">{tb("preview.stillNeeded")}</span>
            {missing.map((step) => (
              <span key={step} className="text-[13px]">
                {tb(`preview.missing.${step}`)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-4 mt-auto -mb-6 flex items-center gap-3 border-t bg-background px-4 pt-3 pb-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold tabular-nums">
              {tb("preview.mobilePerDay", { count: checksPerDay })}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {checksPerDay
                ? tb("preview.perDayDetail", { times: times.length, items: itemsText })
                : form
                  ? tb(hasTargetsStep ? "preview.mobilePick" : "preview.mobilePickWhen")
                  : tb("preview.mobileStart")}
            </span>
          </div>
          <Button type="button" className="h-11" isLoading={isSaving} onClick={() => void save()}>
            <SaveIcon data-icon="inline-start" />
            {tb("save")}
          </Button>
        </div>

        <ResponsiveFormSheet
          open={sheetOpen && Boolean(picker)}
          onOpenChange={setSheetOpen}
          title={tb("targets.title")}
          closeLabel={tb("create.close")}
          footer={
            <Button type="button" className="h-11 w-full" onClick={() => setSheetOpen(false)}>
              {selections.length
                ? tb("targets.doneCount", { items: itemsText })
                : tb("targets.done")}
            </Button>
          }
        >
          {picker}
        </ResponsiveFormSheet>

        {dialogs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="sticky top-0 z-20 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mt-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={tb("back")} onClick={leave}>
            <ArrowLeftIcon />
          </Button>
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">
              {tb("breadcrumb", { location: location.name })}
            </span>
            <h1 className="truncate text-xl font-semibold tracking-tight">{pageTitle}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={leave}>
            {tb("cancel")}
          </Button>
          <Button type="button" isLoading={isSaving} onClick={() => void save()}>
            <SaveIcon data-icon="inline-start" />
            {tb("save")}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <BuilderSection
            id={`${ID}-form-label`}
            step={1}
            done={done.form}
            doneLabel={tb("stepDone")}
            title={tb("form.title")}
            description={tb("form.description")}
          >
            {formPicker}
          </BuilderSection>

          {hasTargetsStep ? (
            <BuilderSection
              id={`${ID}-targets-label`}
              step={stepOf("targets")}
              done={done.targets}
              doneLabel={tb("stepDone")}
              title={tb("targets.title")}
              description={form ? tb("targets.descriptionPick") : tb("targets.descriptionNone")}
            >
              {!form ? (
                <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                  {tb("targets.chooseFormFirst")}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] font-medium">
                      {selections.length
                        ? tb("targets.selected", { items: itemsText })
                        : tb("targets.nothingSelected")}
                    </span>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger render={<Button type="button" variant="outline" />}>
                        <PlusIcon data-icon="inline-start" />
                        {tb("targets.add")}
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-100 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0">
                        {picker}
                      </PopoverContent>
                    </Popover>
                  </div>
                  {selectedList}
                  {targetsRequired}
                </div>
              )}
            </BuilderSection>
          ) : null}

          <BuilderSection
            id={`${ID}-when-label`}
            step={stepOf("when")}
            done={done.when}
            doneLabel={tb("stepDone")}
            title={tb("when.title")}
            description={tb("when.description")}
          >
            <WhenFields
              idPrefix={ID}
              draft={draft}
              onChange={patch}
              daysError={isMissing("days")}
              timesError={isMissing("times")}
              layout="desktop"
            />
          </BuilderSection>

          <BuilderSection
            id={`${ID}-window-label`}
            step={stepOf("window")}
            done={false}
            doneLabel={tb("stepDone")}
            title={tb("window.title")}
            titleExtra={<Badge variant="outline">{tb("window.optional")}</Badge>}
            description={draft.windowOn ? tb("window.on") : tb("window.off")}
            action={windowSwitch}
          >
            <WindowFields idPrefix={ID} draft={draft} times={times} onChange={patch} layout="desktop" />
          </BuilderSection>
        </div>

        <BuilderPreview
          draft={draft}
          form={form}
          times={times}
          targetNames={targetNames}
          itemsText={itemsText}
          checksPerDay={checksPerDay}
          missing={missing}
          showErrors={showErrors}
        />
      </div>

      {dialogs}
    </div>
  );
}

function MobileGlance({
  times,
  window,
}: {
  times: string[];
  window: { opensBefore: number; dueAfter: number | null } | null;
}) {
  const tw = useTranslations("TasksPage.builder.when");
  const tp = useTranslations("TasksPage.builder.preview");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{tw("glance")}</span>
      <DayStrip
        times={times}
        window={window}
        gridHours={HOUR_MARKS.compact}
        label={
          times.length
            ? tp("glanceLabel", { count: times.length, from: times[0]!, until: times.at(-1)! })
            : tp("glanceEmptyLabel")
        }
      />
      <HourRuler hours={HOUR_MARKS.compact} />
    </div>
  );
}
