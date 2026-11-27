import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  GridAction,
  GridBlock,
  GridCell,
  ReadingsGrid,
} from "../lib/journal-document";
import {
  FailValue,
  JournalTableFrame,
  JournalTag,
  UnansweredTag,
  journalTable,
} from "./journal-table";

function CellValue({ cell }: { cell: GridCell | null }) {
  const t = useTranslations("RecordsReportPage");
  if (!cell) return null;
  if (cell.text === "") {
    return cell.missed || cell.open ? (
      <UnansweredTag status={cell.missed ? "missed" : "open"} />
    ) : null;
  }

  return (
    <span className="inline-flex flex-col items-end">
      {cell.voided ? (
        <span className="text-muted-foreground line-through">{cell.text}</span>
      ) : cell.fails ? (
        <FailValue>{cell.text}</FailValue>
      ) : (
        <span>{cell.text}</span>
      )}
      {cell.late ? (
        <span className="text-xs text-muted-foreground">{t("lateSuffix")}</span>
      ) : null}
    </span>
  );
}

function Actions({
  actions,
  voidedTimes,
}: {
  actions: GridAction[];
  voidedTimes: string[];
}) {
  const t = useTranslations("RecordsReportPage");
  // The time only tells actions apart when a day had more than one deviation.
  const timed = actions.length > 1;

  return (
    <div className="flex flex-col gap-1">
      {actions.map((action) => (
        <p key={action.time} className="[overflow-wrap:anywhere]">
          {timed ? (
            <span className="font-medium tabular-nums">{`${action.time} `}</span>
          ) : null}
          {action.text ?? (
            <span className="font-medium text-destructive">
              {t("deviations.noAction")}
            </span>
          )}
        </p>
      ))}
      {voidedTimes.length === 0 ? null : (
        <div className="flex flex-wrap gap-1">
          {voidedTimes.map((time) => (
            <JournalTag key={time}>{t("journal.voidedAt", { time })}</JournalTag>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadingsGridTable({
  grid,
  block,
  title,
}: {
  grid: ReadingsGrid;
  block: GridBlock;
  /** The item, or the journal itself for a check kept for the whole location. */
  title: string;
}) {
  const t = useTranslations("RecordsReportPage");

  return (
    <JournalTableFrame
      title={title}
      aside={
        block.norm === null ? undefined : (
          <span className="tabular-nums">
            <span className="font-semibold">{t("journal.norm")}</span>{" "}
            {block.norm}
          </span>
        )
      }
    >
      <thead>
        <tr>
          <th scope="col" className={cn(journalTable.head, "w-24")}>
            {t("columns.date")}
          </th>
          {grid.times.map((time) => (
            <th
              key={time}
              scope="col"
              className={cn(journalTable.head, "w-16 text-right")}
            >
              {time}
            </th>
          ))}
          <th scope="col" className={journalTable.head}>
            {t("fields.correctiveAction")}
          </th>
          <th scope="col" className={cn(journalTable.head, "w-36")}>
            {t("columns.by")}
          </th>
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, index) => (
          <tr
            key={row.date}
            data-report-entry
            className={cn(
              "last:[&>td]:border-b-0",
              index % 2 === 1 && journalTable.shaded,
            )}
          >
            <td className={cn(journalTable.cell, "font-semibold whitespace-nowrap")}>
              {row.date}
            </td>
            {row.cells.map((cell, cellIndex) => (
              <td
                key={grid.times[cellIndex]}
                className={cn(journalTable.cell, "text-right")}
              >
                <CellValue cell={cell} />
              </td>
            ))}
            <td className={cn(journalTable.cell, journalTable.note)}>
              <Actions
                actions={row.correctiveActions}
                voidedTimes={row.voidedTimes}
              />
            </td>
            <td
              className={cn(
                journalTable.cell,
                journalTable.by,
                "[overflow-wrap:anywhere]",
              )}
            >
              {row.recordedBy.join(", ")}
            </td>
          </tr>
        ))}
      </tbody>
    </JournalTableFrame>
  );
}
