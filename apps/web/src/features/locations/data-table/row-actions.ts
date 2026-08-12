import type { LocationResponse } from "@haccp/shared";
import { PencilIcon, StarIcon, Trash2Icon } from "lucide-react";
import { createElement } from "react";
import type { useTranslations } from "next-intl";
import type { RowAction } from "@/components/ui/data-table/row-action";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type Params = {
  t: LocationsTranslations;
  totalCount: number;
  settingDefaultId: string | null;
  onRename: (location: LocationResponse) => void;
  onSetDefault: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
};

/**
 * "Set as default" moved in here from a button inside the table cell, which is
 * why a phone had no way to do it at all — the mobile card never rendered that
 * column.
 *
 * Delete is disabled rather than hidden when it cannot run, with the reason
 * attached: a control that vanishes teaches nothing about why.
 */
export function getLocationRowActions({
  t,
  totalCount,
  settingDefaultId,
  onRename,
  onSetDefault,
  onDelete,
}: Params) {
  return (location: LocationResponse): RowAction[] => {
    const canDelete = !location.isDefault && totalCount > 1;

    return [
      {
        id: "rename",
        label: t("rename"),
        role: "primary",
        icon: createElement(PencilIcon),
        onSelect: () => onRename(location),
      },
      {
        id: "set-default",
        label: t("setAsDefault"),
        icon: createElement(StarIcon),
        hidden: location.isDefault,
        disabled: settingDefaultId !== null,
        onSelect: () => onSetDefault(location),
      },
      {
        id: "delete",
        label: t("delete"),
        role: "destructive",
        icon: createElement(Trash2Icon),
        disabled: !canDelete,
        disabledReason: canDelete
          ? undefined
          : location.isDefault
            ? t("tooltips.cannotDeleteDefault")
            : t("tooltips.cannotDeleteLast"),
        onSelect: () => onDelete(location),
      },
    ];
  };
}
