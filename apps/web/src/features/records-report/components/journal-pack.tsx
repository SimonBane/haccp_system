import type { FormVersionSummaryMap, RecordItem } from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { DeviationRow } from "../lib/deviation-rows";
import {
  JOURNAL_SHAPE,
  toJournalDocuments,
  type JournalDocument,
  type JournalDocumentContext,
} from "../lib/journal-document";
import { ChecklistSheetTable } from "./checklist-sheet-table";
import { DeviationsTable } from "./deviations-table";
import { EntryLogTable } from "./entry-log-table";
import { JournalHeading } from "./journal-heading";
import { JournalSignOff } from "./journal-sign-off";
import { ReadingsGridTable } from "./readings-grid-table";

type JournalPackProps = {
  items: readonly RecordItem[];
  formVersions: FormVersionSummaryMap;
  format: JournalDocumentContext["format"];
  limits: JournalDocumentContext["limits"];
  /** "Organization · Location · Period", repeated on every journal so a page stands on its own. */
  context: string;
  /** Null when the deviations report was not asked for. */
  deviations: DeviationRow[] | null;
};

function JournalBodyView({ document }: { document: JournalDocument }) {
  const body = document.body;

  if (body.shape === JOURNAL_SHAPE.GRID) {
    return (
      <div className="flex flex-col gap-7">
        {body.grid.blocks.map((block) => (
          <section key={block.key} className="break-inside-avoid-page">
            <ReadingsGridTable
              grid={body.grid}
              block={block}
              title={block.targetName ?? document.name}
            />
          </section>
        ))}
      </div>
    );
  }

  if (body.shape === JOURNAL_SHAPE.CHECKLIST) {
    return (
      <div className="flex flex-col gap-7">
        {body.checklist.sheets.map((sheet) => (
          <ChecklistSheetTable
            key={sheet.key}
            sheet={sheet}
            columns={body.checklist.columns}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {body.log.groups.map((group) => (
        <section key={group.key}>
          <EntryLogTable columns={body.log.columns} group={group} />
        </section>
      ))}
    </div>
  );
}

export function JournalPack({
  items,
  formVersions,
  format,
  limits,
  context,
  deviations,
}: JournalPackProps) {
  const tDeviations = useTranslations("RecordsReportPage.deviations");
  const documents = toJournalDocuments(items, { formVersions, format, limits });

  return (
    <>
      {documents.map((document, index) => (
        <section
          key={document.id}
          data-report-journal
          data-wide={document.wide ? "" : undefined}
          className={
            index === 0
              ? undefined
              : "mt-12 border-t pt-8 print:mt-0 print:border-t-0 print:pt-0"
          }
        >
          <JournalHeading
            name={document.name}
            context={context}
            entryCount={document.summary.total}
          />
          <JournalBodyView document={document} />
          <JournalSignOff />
        </section>
      ))}

      {deviations === null ? null : (
        <section
          data-report-journal
          className="mt-12 border-t pt-8 print:mt-0 print:border-t-0 print:pt-0"
        >
          <header className="mb-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tDeviations("title")}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{context}</p>
          </header>
          <DeviationsTable rows={deviations} />
        </section>
      )}
    </>
  );
}
