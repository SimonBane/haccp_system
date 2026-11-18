"use client";

import {
  API_ERROR_CODE,
  TARGET_KIND,
  TARGET_KIND_VALUES,
  type LibraryLocale,
  type TargetKind,
  type TargetTypeResponse,
} from "@haccp/shared";
import { PencilIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTargetTypesMutations } from "@/features/targets/hooks/use-target-types-mutations";
import {
  missingStarterTypes,
  TARGET_KIND_ICONS,
} from "@/features/targets/lib/target-kinds";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

const FORM_ID = "target-type-form";

type Draft = { id: string | null; name: string; kind: TargetKind };

const EMPTY_DRAFT: Draft = { id: null, name: "", kind: TARGET_KIND.EQUIPMENT };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: TargetTypeResponse[];
};

export function TargetTypesDialog({ open, onOpenChange, types }: Props) {
  const t = useTranslations("TargetsPage.types");
  const tKinds = useTranslations("TargetsPage.kinds");
  const locale = useLocale() as LibraryLocale;
  const showApiError = useApiErrorToast();
  const { create, update, remove } = useTargetTypesMutations();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TargetTypeResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const suggestions = missingStarterTypes(types, locale);
  const isEditing = draft.id !== null;

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setNameError(null);
  }

  async function saveDraft() {
    const name = draft.name.trim();
    if (name === "") {
      setNameError(t("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      if (draft.id) {
        await update.mutateAsync({
          id: draft.id,
          input: { name, kind: draft.kind },
        });
        toast.success(t("updated"));
      } else {
        await create.mutateAsync({ name, kind: draft.kind });
        toast.success(t("created"));
      }
      resetDraft();
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.TARGET_TYPE_NAME_EXISTS
      ) {
        setNameError(t("nameTaken"));
        return;
      }
      showApiError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function addSuggestion(key: string, name: string, kind: TargetKind) {
    setAddingKey(key);
    try {
      await create.mutateAsync({ name, kind });
    } catch (error) {
      showApiError(error);
    } finally {
      setAddingKey(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("deleted"));
      if (draft.id === deleteTarget.id) resetDraft();
      setDeleteTarget(null);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsDeleting(false);
    }
  }

  const kindItems = TARGET_KIND_VALUES.map((kind) => ({
    value: kind,
    label: tKinds(kind),
  }));

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetDraft();
        onOpenChange(next);
      }}
      title={t("title")}
      description={t("description")}
      closeLabel={t("close")}
      className="sm:max-w-lg"
    >
      <div className="grid gap-6">
        {types.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {types.map((type) => {
              const KindIcon = TARGET_KIND_ICONS[type.kind];
              return (
                <li key={type.id} className="flex items-center gap-3 px-3 py-2">
                  <KindIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {type.name}
                  </span>
                  <Badge variant="outline" className="font-normal">
                    {tKinds(type.kind)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("edit", { name: type.name })}
                    onClick={() => {
                      setDraft({
                        id: type.id,
                        name: type.name,
                        kind: type.kind,
                      });
                      setNameError(null);
                    }}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("delete", { name: type.name })}
                    onClick={() => setDeleteTarget(type)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}

        {suggestions.length > 0 ? (
          <FieldSet className="gap-2">
            <FieldLegend variant="label">{t("suggestions")}</FieldLegend>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={addingKey === suggestion.key}
                  disabled={addingKey !== null}
                  onClick={() =>
                    void addSuggestion(
                      suggestion.key,
                      suggestion.name,
                      suggestion.kind,
                    )
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  {suggestion.name}
                </Button>
              ))}
            </div>
          </FieldSet>
        ) : null}

        <FieldSeparator />

        <form
          id={FORM_ID}
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveDraft();
          }}
        >
          <FieldLegend variant="label">
            {isEditing ? t("editTitle") : t("addTitle")}
          </FieldLegend>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel htmlFor={`${FORM_ID}-name`}>
                {t("nameLabel")}
              </FieldLabel>
              <Input
                id={`${FORM_ID}-name`}
                value={draft.name}
                maxLength={100}
                aria-invalid={Boolean(nameError)}
                placeholder={t("namePlaceholder")}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                  setNameError(null);
                }}
              />
              {nameError ? (
                <FieldError errors={[{ message: nameError }]} />
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${FORM_ID}-kind`}>
                {t("kindLabel")}
              </FieldLabel>
              <Select
                items={kindItems}
                value={draft.kind}
                onValueChange={(value: unknown) =>
                  setDraft((current) => ({
                    ...current,
                    kind: value as TargetKind,
                  }))
                }
              >
                <SelectTrigger id={`${FORM_ID}-kind`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {kindItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <Button type="button" variant="outline" onClick={resetDraft}>
                {t("cancelEdit")}
              </Button>
            ) : null}
            <Button type="submit" isLoading={isSaving}>
              {isEditing ? (
                <SaveIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {isEditing ? t("save") : t("add")}
            </Button>
          </div>
        </form>
      </div>

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !isDeleting) setDeleteTarget(null);
        }}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        cancelLabel={t("cancelDelete")}
        confirmLabel={t("confirmDelete")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isDeleting}
        cancelDisabled={isDeleting}
        onConfirm={() => void confirmDelete()}
      />
    </ResponsiveFormDialog>
  );
}
