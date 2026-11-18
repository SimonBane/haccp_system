"use client";

import type { FormCategory, FormListItem } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";

type FormsTranslations = ReturnType<typeof useTranslations<"FormsPage">>;

type GetColumnsParams = {
  t: FormsTranslations;
  categoryLabels: Record<FormCategory, string>;
  getRowActions: GetRowActions<FormListItem>;
};

export function getColumns({
  t,
  categoryLabels,
  getRowActions,
}: GetColumnsParams): ColumnDef<FormListItem>[] {
  return [
    {
      accessorKey: "name",
      enableHiding: false,
      meta: { view_label: t("columns.name") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.name")} />
      ),
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "category",
      meta: { view_label: t("columns.category") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.category")} />
      ),
      cell: ({ row }) => {
        const Icon = FORM_CATEGORY_ICONS[row.original.category];
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {categoryLabels[row.original.category]}
          </span>
        );
      },
      sortingFn: (rowA, rowB) =>
        categoryLabels[rowA.original.category].localeCompare(
          categoryLabels[rowB.original.category],
        ),
    },
    {
      id: "fields",
      accessorFn: (row) => row.latestVersion.definition.fields.length,
      meta: { view_label: t("columns.fields") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.fields")} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.latestVersion.definition.fields.length}
        </span>
      ),
    },
    {
      accessorKey: "templateCount",
      meta: { view_label: t("columns.usedBy") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.usedBy")} />
      ),
      cell: ({ row }) => (
        <span
          className={
            row.original.templateCount === 0
              ? "text-muted-foreground"
              : "tabular-nums"
          }
        >
          {t("usedBy", { count: row.original.templateCount })}
        </span>
      ),
    },
    {
      id: "version",
      accessorFn: (row) => row.latestVersion.version,
      enableSorting: false,
      meta: { view_label: t("columns.version") },
      header: () => t("columns.version"),
      cell: ({ row }) => (
        <Badge variant="outline" className="tabular-nums">
          {t("versionBadge", { version: row.original.latestVersion.version })}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DataTableRowActions
          srLabel={t("openMenu")}
          actions={getRowActions(row.original)}
        />
      ),
    },
  ];
}
