import { useTranslations } from "next-intl";
import type { DeviationRow } from "../lib/deviation-rows";

export function DeviationsTable({ rows }: { rows: DeviationRow[] }) {
  const t = useTranslations("RecordsReportPage");

  if (rows.length === 0) {
    return (
      <section className="py-8">
        <h2 className="text-base font-semibold">
          {t("deviations.empty.title")}
        </h2>
        <p className="text-sm">{t("deviations.empty.description")}</p>
      </section>
    );
  }

  return (
    <table className="w-full table-fixed border-collapse text-left text-[11px] leading-tight">
      <thead>
        <tr className="border-b border-black/40">
          <th scope="col" className="w-20 py-1 pr-2 font-semibold">
            {t("columns.date")}
          </th>
          <th scope="col" className="w-12 py-1 pr-2 font-semibold">
            {t("columns.time")}
          </th>
          <th scope="col" className="py-1 pr-2 font-semibold">
            {t("columns.task")}
          </th>
          <th scope="col" className="py-1 pr-2 font-semibold">
            {t("deviations.whatFailed")}
          </th>
          <th scope="col" className="py-1 pr-2 font-semibold">
            {t("fields.correctiveAction")}
          </th>
          <th scope="col" className="w-28 py-1 font-semibold">
            {t("columns.by")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            data-report-entry
            data-row-id={row.id}
            className="border-b border-black/15 align-top"
          >
            <td className="py-1 pr-2 whitespace-nowrap tabular-nums">
              {row.date}
            </td>
            <td className="py-1 pr-2 tabular-nums">{row.time}</td>
            <td className="py-1 pr-2 [overflow-wrap:anywhere]">
              {row.targetName === null
                ? row.title
                : `${row.title} · ${row.targetName}`}
            </td>
            <td className="py-1 pr-2 [overflow-wrap:anywhere]">
              {row.failed.map((answer, index) => (
                <p key={index}>
                  <span className="font-semibold">{answer.label}:</span>{" "}
                  <span className="tabular-nums">{answer.text}</span>
                  {answer.limit === null
                    ? null
                    : ` (${t("deviations.limit", { limit: answer.limit })})`}
                </p>
              ))}
            </td>
            <td className="py-1 pr-2 [overflow-wrap:anywhere]">
              {row.correctiveAction ?? t("deviations.noAction")}
            </td>
            <td className="py-1 [overflow-wrap:anywhere]">
              {row.recordedBy ?? t("unknownUser")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
