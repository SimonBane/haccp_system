import {
  RECORD_TIMING,
  type FormVersionSummaryMap,
  type RecordItem,
} from "@haccp/shared";
import { resolvedTiming, showsTiming } from "@/features/records/lib/labels";
import { reportStatus } from "./report-rows";

/** One check's rows in the report: its journal. */
export type Journal = {
  /** The form id, or the form version id when the version is missing from the response. */
  id: string;
  name: string;
  items: RecordItem[];
};

export type JournalSummary = {
  id: string;
  name: string;
  total: number;
  /** Recorded and not voided, whether it passed or failed. */
  done: number;
  late: number;
  failed: number;
  missed: number;
};

/** By form, not version, so a period spanning versions stays one journal; rows keep the API order. */
export function splitIntoJournals(
  items: readonly RecordItem[],
  formVersions: FormVersionSummaryMap,
): Journal[] {
  const journals = new Map<string, Journal & { version: number }>();

  for (const item of items) {
    const summary = formVersions[item.formVersionId];
    const id = summary?.formId ?? item.formVersionId;
    const journal = journals.get(id);

    if (!journal) {
      journals.set(id, {
        id,
        name: summary?.formName ?? item.title,
        version: summary?.version ?? 0,
        items: [item],
      });
      continue;
    }

    journal.items.push(item);
    // The newest version's name is the one the business uses now.
    if (summary && summary.version > journal.version) {
      journal.name = summary.formName;
      journal.version = summary.version;
    }
  }

  return [...journals.values()]
    .map(({ id, name, items: rows }) => ({ id, name, items: rows }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function summarizeJournal(journal: Journal): JournalSummary {
  const summary: JournalSummary = {
    id: journal.id,
    name: journal.name,
    total: journal.items.length,
    done: 0,
    late: 0,
    failed: 0,
    missed: 0,
  };

  for (const item of journal.items) {
    const status = reportStatus(item);
    if (status === "done" || status === "fail") summary.done += 1;
    if (status === "fail") summary.failed += 1;
    if (status === "missed") summary.missed += 1;
    if (
      showsTiming(item.displayState, item.timing) &&
      resolvedTiming(item) === RECORD_TIMING.LATE
    ) {
      summary.late += 1;
    }
  }

  return summary;
}
