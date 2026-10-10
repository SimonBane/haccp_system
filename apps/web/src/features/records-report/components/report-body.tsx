import { useTranslations } from "next-intl";
import { groupReportRowsByDate, type ReportRow } from "../lib/report-rows";

const COLUMN_COUNT = 5;

export function ReportBody({ rows }: { rows: ReportRow[] }) {
  const t = useTranslations("RecordsReportPage");

  return (
    <table className="w-full table-fixed border-collapse text-left text-[11px] leading-tight">
      <thead>
        <tr className="border-b border-black/40">
          <th scope="col" className="w-12 py-1 pr-2 font-semibold">
            {t("columns.time")}
          </th>
          <th scope="col" className="py-1 pr-2 font-semibold">
            {t("columns.task")}
          </th>
          <th scope="col" className="w-40 py-1 pr-2 font-semibold">
            {t("columns.answers")}
          </th>
          <th scope="col" className="w-32 py-1 pr-2 font-semibold">
            {t("columns.status")}
          </th>
          <th scope="col" className="w-32 py-1 font-semibold">
            {t("columns.by")}
          </th>
        </tr>
      </thead>

      {groupReportRowsByDate(rows).map((group) => [
        <tbody key={`date-${group.date}`} data-report-date>
          <tr className="border-t border-black/40">
            <th
              scope="colgroup"
              colSpan={COLUMN_COUNT}
              className="pt-2 pb-0.5 font-semibold tabular-nums"
            >
              {group.date}
            </th>
          </tr>
        </tbody>,
        ...group.rows.map((row) => (
          <tbody
            key={row.occurrenceId}
            data-report-record
            data-occurrence-id={row.occurrenceId}
            className="border-b border-black/15 align-top"
          >
            <tr>
              <td className="py-0.5 pr-2 whitespace-nowrap tabular-nums">
                {row.scheduledTime}
              </td>
              <td className="py-0.5 pr-2 [overflow-wrap:anywhere]">
                {row.targetName === undefined
                  ? row.title
                  : `${row.title} · ${row.targetName}`}
              </td>
              <td className="py-0.5 pr-2 tabular-nums [overflow-wrap:anywhere]">
                {row.answers ?? ""}
              </td>
              <td
                className={
                  row.status === "fail" || row.status === "missed"
                    ? "py-0.5 pr-2 font-semibold"
                    : "py-0.5 pr-2"
                }
              >
                {row.late
                  ? `${t(`status.${row.status}`)}, ${t("lateSuffix")}`
                  : t(`status.${row.status}`)}
              </td>
              <td className="py-0.5 [overflow-wrap:anywhere]">
                {row.recordedBy === undefined
                  ? ""
                  : (row.recordedBy ?? t("unknownUser"))}
              </td>
            </tr>
            {row.correctiveAction !== undefined && (
              <tr>
                <td />
                <td
                  colSpan={COLUMN_COUNT - 1}
                  className="pb-1 italic [overflow-wrap:anywhere]"
                >
                  {t("fields.correctiveAction")}: {row.correctiveAction}
                </td>
              </tr>
            )}
          </tbody>
        )),
      ])}
    </table>
  );
}
