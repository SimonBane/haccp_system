"use client";

import {
  EQUIPMENT_DEFAULT_TEMPS,
  type CreateEquipmentInput,
  type EquipmentResponse,
  type EquipmentType,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { CopyPlusIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingButtonLabel } from "@/components/loading-button-label";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError } from "@/lib/api-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EquipmentFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: EquipmentResponse | null;
  duplicateSource?: EquipmentResponse | null;
  suggestedDuplicateName?: string;
  existingItems?: Pick<EquipmentResponse, "id" | "name">[];
  onDuplicate?: () => void;
  onSubmit: (
    values: CreateEquipmentInput | UpdateEquipmentInput,
  ) => Promise<void>;
};

const EQUIPMENT_TYPES: EquipmentType[] = [
  "fridge",
  "freezer",
  "display_case",
];

export function EquipmentForm({
  open,
  onOpenChange,
  equipment,
  duplicateSource,
  suggestedDuplicateName,
  existingItems = [],
  onDuplicate,
  onSubmit,
}: EquipmentFormProps) {
  const t = useTranslations("EquipmentPage");
  const isEditing = Boolean(equipment);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;

  const [name, setName] = useState("");
  const [type, setType] = useState<EquipmentType>("fridge");
  const [minTempC, setMinTempC] = useState("0");
  const [maxTempC, setMaxTempC] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    if (equipment) {
      setName(equipment.name);
      setType(equipment.type);
      setMinTempC(String(equipment.minTempC));
      setMaxTempC(String(equipment.maxTempC));
    } else if (duplicateSource) {
      setName(suggestedDuplicateName ?? `${duplicateSource.name} (Copy)`);
      setType(duplicateSource.type);
      setMinTempC(String(duplicateSource.minTempC));
      setMaxTempC(String(duplicateSource.maxTempC));
    } else {
      setName("");
      setType("fridge");
      setMinTempC(String(EQUIPMENT_DEFAULT_TEMPS.fridge.minTempC));
      setMaxTempC(String(EQUIPMENT_DEFAULT_TEMPS.fridge.maxTempC));
    }

    setError(null);
    setNameError(null);
    setIsSubmitting(false);
  }, [open, equipment, duplicateSource, suggestedDuplicateName]);

  useEffect(() => {
    if (!open || !duplicateSource || equipment) return;

    const timeoutId = window.setTimeout(() => {
      const input = nameInputRef.current;
      input?.focus();
      input?.select();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, equipment, duplicateSource, suggestedDuplicateName]);

  function validateName(value: string): string | null {
    const trimmedName = value.trim();
    const isTaken = existingItems.some(
      (item) => item.name === trimmedName && item.id !== equipment?.id,
    );

    return isTaken ? t("nameTaken") : null;
  }

  function handleNameChange(value: string) {
    setName(value);
    if (nameError) setNameError(null);
    if (error) setError(null);
  }

  const typeLabels: Record<EquipmentType, string> = {
    fridge: t("types.fridge"),
    freezer: t("types.freezer"),
    display_case: t("types.displayCase"),
  };

  function handleTypeChange(nextType: EquipmentType) {
    setType(nextType);
    if (!isEditing) {
      setMinTempC(String(EQUIPMENT_DEFAULT_TEMPS[nextType].minTempC));
      setMaxTempC(String(EQUIPMENT_DEFAULT_TEMPS[nextType].maxTempC));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNameError(null);

    const nextNameError = validateName(name);
    if (nextNameError) {
      setNameError(nextNameError);
      return;
    }

    setIsSubmitting(true);

    try {
      const values = {
        name: name.trim(),
        type,
        minTempC: Number(minTempC),
        maxTempC: Number(maxTempC),
      };

      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      if (
        submitError instanceof ApiRequestError &&
        submitError.code === "CONFLICT"
      ) {
        setNameError(t("nameTaken"));
      } else {
        setError(
          submitError instanceof Error
            ? submitError.message
            : t("submitError"),
        );
      }
    }
  }

  const numberInputNoSpinClass =
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl">
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

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="equipment-name">{t("nameLabel")}</Label>
            <Input
              ref={nameInputRef}
              id="equipment-name"
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder={t("namePlaceholder")}
              required
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? (
              <p className="text-sm text-destructive" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("typeLabel")}</Label>
            <Select
              value={type}
              onValueChange={(value: unknown) =>
                handleTypeChange(value as EquipmentType)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("typePlaceholder")}>
                  {typeLabels[type]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT_TYPES.map((equipmentType) => (
                  <SelectItem key={equipmentType} value={equipmentType}>
                    {typeLabels[equipmentType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equipment-min-temp">{t("minTempLabel")}</Label>
              <Input
                id="equipment-min-temp"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={minTempC}
                onChange={(event) => setMinTempC(event.target.value)}
                required
                className={numberInputNoSpinClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment-max-temp">{t("maxTempLabel")}</Label>
              <Input
                id="equipment-max-temp"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={maxTempC}
                onChange={(event) => setMaxTempC(event.target.value)}
                required
                className={numberInputNoSpinClass}
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

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
                  className="relative"
                  disabled={isSubmitting}
                >
                  <LoadingButtonLabel loading={isSubmitting}>
                    <SaveIcon data-icon="inline-start" />
                    {t("save")}
                  </LoadingButtonLabel>
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                className="relative"
                disabled={isSubmitting}
              >
                <LoadingButtonLabel loading={isSubmitting}>
                  <PlusIcon data-icon="inline-start" />
                  {t("add")}
                </LoadingButtonLabel>
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
