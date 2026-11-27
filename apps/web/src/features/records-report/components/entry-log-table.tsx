import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  EntryLogColumn,
  EntryLogGroup,
  EntryLogRow,
} from "../lib/entry-log";
import {
  FailValue,
  JournalTableFrame,
  JournalTag,
  UnansweredTag,
  journalTable,
} from "./journal-table";

function FieldCells({
  row,
  columns,
}: {
  row: EntryLogRow;
  columns: EntryLogColumn[];
}) {
  if (row.status === "missed" || row.status === "open") {
    return (
      <td colSpan={columns.length} className={journalTable.cell}>
        <UnansweredTag status={row.status} />
      </td>
    );
  }

  const voided = row.status === "voided";
  return columns.map((column, index) => {
    const cell = row.cells[index];
    return (
      <td
        key={column.fieldId}
        className={cn(
          journalTable.cell,
          "[overflow-wrap:anywhere]",
          column.numeric && "text-right",
        )}
      >
        {!cell ? null : voided ? (
          <span className="text-muted-foreground line-through">{cell.text}</span>
        ) : cell.fails ? (
          <FailValue>{cell.text}</FailValue>
        ) : (
          cell.text
        )}
      </td>
    );
  });
}

/** One row per check, a day's checks under one date, so a form with several fields stays readable. */
export function EntryLogTable({
  columns,
  group,
}: {
  columns: EntryLogColumn[];
  group: EntryLogGroup;
}) {
  const t = useTranslations("RecordsReportPage");
  const hasNorms = group.norms.some((norm) => norm !== null);

  return (
    <JournalTableFrame title={group.targetName ?? undefined}>
      <thead>
        <tr>
          <th scope="col" className={cn(journalTable.head, "w-24")}>
            {t("columns.date")}
          </th>
          <th scope="col" className={cn(journalTable.head, "w-16")}>
            {t("columns.time")}
          </th>
          {columns.map((column) => (
            <th
              key={column.fieldId}
              scope="col"
              className={cn(
                journalTable.head,
                "[overflow-wrap:anywhere]",
                column.numeric && "text-right",
              )}
            >
              {column.label}
            </th>
          ))}
          <th scope="col" className={cn(journalTable.head, "w-[26%]")}>
            {t("fields.correctiveAction")}
          </th>
          <th scope="col" className={cn(journalTable.head, "w-28")}>
            {t("columns.by")}
          </th>
        </tr>
        {hasNorms ? (
          <tr>
            <th
              scope="row"
              colSpan={2}
              className={cn(journalTable.norm, "font-medium")}
            >
              {t("journal.norm")}
            </th>
            {group.norms.map((norm, index) => (
              <th
                key={columns[index]!.fieldId}
                className={cn(
                  journalTable.norm,
                  columns[index]!.numeric && "text-right",
                )}
              >
                {norm}
              </th>
            ))}
            <th className={journalTable.norm} />
            <th className={journalTable.norm} />
          </tr>
        ) : null}
      </thead>
      {group.days.map((day, dayIndex) => (
        <tbody
          key={day.date}
          className={cn(
            "last:[&>tr:last-child>td]:border-b-0",
            dayIndex % 2 === 1 && journalTable.shaded,
          )}
        >
          {day.rows.map((row, rowIndex) => (
            <tr key={row.id} data-report-entry data-row-id={row.id}>
              {rowIndex === 0 ? (
                <td
                  rowSpan={day.rows.length}
                  className={cn(
                    journalTable.cell,
                    "font-semibold whitespace-nowrap",
                  )}
                >
                  {day.date}
                </td>
              ) : null}
              <td className={cn(journalTable.cell, "text-muted-foreground")}>
                <span className="flex flex-wrap items-center gap-1">
                  {row.time}
                  {row.late ? <JournalTag>{t("lateSuffix")}</JournalTag> : null}
                </span>
              </td>
              <FieldCells row={row} columns={columns} />
              <td
                className={cn(
                  journalTable.cell,
                  journalTable.note,
                  "[overflow-wrap:anywhere]",
                )}
              >
                {row.status === "voided" ? (
                  <JournalTag>{t("status.voided")}</JournalTag>
                ) : row.status === "fail" ? (
                  (row.correctiveAction ?? (
                    <span className="font-medium text-destructive">
                      {t("deviations.noAction")}
                    </span>
                  ))
                ) : (
                  row.correctiveAction
                )}
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
          ))}
        </tbody>
      ))}
    </JournalTableFrame>
  );
}
