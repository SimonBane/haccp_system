import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { ReportAttribution, ReportRow } from "../lib/report-rows";

const TIMING_KEY = {
  not_submitted: "notSubmitted",
  on_time: "onTime",
  late: "late",
  no_deadline: "noDeadline",
} as const;

const RESULT_KEY = {
  pass: "pass",
  fail: "fail",
  not_evaluated: "notEvaluated",
} as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="mr-4 inline-block">
      <span className="font-medium">{label}:</span> {children}
    </span>
  );
}

function AttributionFact({
  label,
  value,
  unknownUser,
}: {
  label: string;
  value: ReportAttribution;
  unknownUser: string;
}) {
  return (
    <Fact label={label}>{`${value.by ?? unknownUser} · ${value.at}`}</Fact>
  );
}

export function ReportBody({ rows }: { rows: ReportRow[] }) {
  const t = useTranslations("RecordsReportPage");
  const labels = useTranslations("RecordsPage");

  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-black/40">
          <th scope="col" className="w-28 py-1 pr-2 font-semibold">
            {t("columns.scheduled")}
          </th>
          <th scope="col" className="py-1 pr-2 font-semibold">
            {t("columns.task")}
          </th>
          <th scope="col" className="w-24 py-1 pr-2 font-semibold">
            {t("columns.status")}
          </th>
          <th scope="col" className="w-24 py-1 pr-2 font-semibold">
            {t("columns.timing")}
          </th>
          <th scope="col" className="w-20 py-1 pr-2 font-semibold">
            {t("columns.reading")}
          </th>
          <th scope="col" className="w-32 py-1 font-semibold">
            {t("columns.outcome")}
          </th>
        </tr>
      </thead>

      {rows.map((row) => (
        <tbody
          key={row.occurrenceId}
          data-report-record
          data-occurrence-id={row.occurrenceId}
          className="border-b border-black/15 align-top"
        >
          <tr>
            <td className="py-1 pr-2 tabular-nums">
              {row.scheduledDate}
              <br />
              {row.scheduledTime}
            </td>
            <td className="py-1 pr-2 [overflow-wrap:anywhere]">
              <span className="font-medium">{row.title}</span>
              {row.equipmentName !== undefined && (
                <>
                  <br />
                  {row.equipmentName}
                </>
              )}
            </td>
            <td className="py-1 pr-2">
              {labels(`displayState.${row.displayState}`)}
            </td>
            <td className="py-1 pr-2">
              {row.timing === undefined
                ? ""
                : labels(`timing.${TIMING_KEY[row.timing]}`)}
            </td>
            <td className="py-1 pr-2 tabular-nums">{row.reading ?? ""}</td>
            <td className="py-1">
              {row.result === undefined
                ? ""
                : labels(`result.${RESULT_KEY[row.result]}`)}
            </td>
          </tr>

          <tr>
            <td colSpan={6} className="pb-1.5 [overflow-wrap:anywhere]">
              <Fact label={t("fields.availableFrom")}>{row.availableAt}</Fact>
              {row.dueAt !== undefined && (
                <Fact label={t("fields.deadline")}>{row.dueAt}</Fact>
              )}
              {row.permittedRange !== undefined && (
                <Fact label={t("fields.permittedRange")}>
                  {row.permittedRange}
                </Fact>
              )}
              {row.created !== undefined && (
                <AttributionFact
                  label={t("fields.created")}
                  value={row.created}
                  unknownUser={t("unknownUser")}
                />
              )}
              {row.recorded !== undefined && (
                <AttributionFact
                  label={t("fields.recorded")}
                  value={row.recorded}
                  unknownUser={t("unknownUser")}
                />
              )}
              {row.voided !== undefined && (
                <AttributionFact
                  label={t("fields.voided")}
                  value={row.voided}
                  unknownUser={t("unknownUser")}
                />
              )}
              {row.correctiveAction !== undefined && (
                <Fact label={t("fields.correctiveAction")}>
                  {row.correctiveAction}
                </Fact>
              )}
            </td>
          </tr>
        </tbody>
      ))}
    </table>
  );
}
