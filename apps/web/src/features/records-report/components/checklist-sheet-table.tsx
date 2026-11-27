import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { EntryLogColumn } from "../lib/entry-log";
import type { ChecklistRow, ChecklistSheet } from "../lib/journal-document";
import {
  FailValue,
  JournalTableFrame,
  JournalTag,
  StatusMark,
  journalTable,
} from "./journal-table";

function SheetSummary({ sheet }: { sheet: ChecklistSheet }) {
  const t = useTranslations("RecordsReportPage.journal");
  const { summary } = sheet;

  return (
    <span>
      {[
        t("sheetDone", { done: summary.done, total: summary.total }),
        summary.failed > 0 ? t("sheetFailed", { count: summary.failed }) : null,
        summary.missed > 0 ? t("sheetMissed", { count: summary.missed }) : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </span>
  );
}

function ItemRow({
  row,
  columns,
  inArea,
}: {
  row: ChecklistRow;
  columns: EntryLogColumn[];
  inArea: boolean;
}) {
  const t = useTranslations("RecordsReportPage");
  const unanswered = row.status === "missed" || row.status === "open";
  const voided = row.status === "voided";

  return (
    <tr data-report-entry data-row-id={row.id}>
      <td
        className={cn(
          journalTable.cell,
          "[overflow-wrap:anywhere]",
          inArea && "pl-7",
        )}
      >
        {row.itemName}
      </td>
      {columns.map((column, index) => {
        const cell = row.cells[index];
        return (
          <td
            key={column.fieldId}
            className={cn(journalTable.cell, "[overflow-wrap:anywhere]")}
          >
            {unanswered ? (
              <span className="text-muted-foreground">—</span>
            ) : !cell ? null : voided ? (
              <span className="text-muted-foreground line-through">
                {cell.text}
              </span>
            ) : cell.fails ? (
              <FailValue>{cell.text}</FailValue>
            ) : (
              cell.text
            )}
          </td>
        );
      })}
      <td className={journalTable.cell}>
        <span className="flex flex-wrap items-center gap-1">
          <StatusMark status={row.status} />
          {row.late ? <JournalTag>{t("lateSuffix")}</JournalTag> : null}
        </span>
      </td>
      <td
        className={cn(
          journalTable.cell,
          journalTable.note,
          "[overflow-wrap:anywhere]",
        )}
      >
        {row.status === "fail"
          ? (row.correctiveAction ?? (
              <span className="font-medium text-destructive">
                {t("deviations.noAction")}
              </span>
            ))
          : row.correctiveAction}
      </td>
      <td
        className={cn(
          journalTable.cell,
          journalTable.by,
          "[overflow-wrap:anywhere]",
        )}
      >
        {row.recordedBy === undefined
          ? "—"
          : (row.recordedBy ?? t("unknownUser"))}
      </td>
    </tr>
  );
}

/** One day's round of the checklist; items in an area sit indented under it. */
export function ChecklistSheetTable({
  sheet,
  columns,
}: {
  sheet: ChecklistSheet;
  columns: EntryLogColumn[];
}) {
  const t = useTranslations("RecordsReportPage");
  const span = columns.length + 4;

  return (
    <section className="break-inside-avoid-page">
      <JournalTableFrame
        title={
          <span className="tabular-nums">{`${sheet.date} · ${sheet.time}`}</span>
        }
        aside={<SheetSummary sheet={sheet} />}
      >
        <thead>
          <tr>
            <th scope="col" className={cn(journalTable.head, "w-[24%]")}>
              {t("columns.item")}
            </th>
            {columns.map((column) => (
              <th
                key={column.fieldId}
                scope="col"
                className={cn(journalTable.head, "[overflow-wrap:anywhere]")}
              >
                {column.label}
              </th>
            ))}
            <th scope="col" className={cn(journalTable.head, "w-28")}>
              {t("columns.result")}
            </th>
            <th scope="col" className={journalTable.head}>
              {t("fields.correctiveAction")}
            </th>
            <th scope="col" className={cn(journalTable.head, "w-24")}>
              {t("columns.by")}
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {sheet.groups.map((group) => (
            <Fragment key={group.area ?? ""}>
              {group.area === null ? null : (
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={span}
                    className={cn(
                      journalTable.cell,
                      journalTable.shaded,
                      "py-1.5 font-semibold text-(--report-ink)",
                    )}
                  >
                    {group.area}
                  </th>
                </tr>
              )}
              {group.rows.map((row) => (
                <ItemRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  inArea={group.area !== null}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </JournalTableFrame>
    </section>
  );
}
