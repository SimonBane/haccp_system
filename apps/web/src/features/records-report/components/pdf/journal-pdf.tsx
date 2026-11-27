import path from "node:path";
import {
  Circle,
  Document,
  Font,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { DeviationRow } from "../../lib/deviation-rows";
import type { EntryLogColumn, EntryLogGroup, EntryLogRow } from "../../lib/entry-log";
import {
  JOURNAL_SHAPE,
  type ChecklistSheet,
  type ChecklistSummary,
  type GridBlock,
  type GridCell,
  type JournalDocument,
  type ReadingsGrid,
} from "../../lib/journal-document";
import type { ReportStatus } from "../../lib/report-rows";

/** Every printed word arrives translated: the PDF has no next-intl provider to read from. */
export type JournalPdfLabels = {
  documentTitle: string;
  brand: string;
  title: string;
  position: (index: number, total: number) => string;
  empty: { title: string; description: string };
  columns: {
    date: string;
    time: string;
    item: string;
    task: string;
    result: string;
    by: string;
    correctiveAction: string;
    whatFailed: string;
  };
  status: Record<ReportStatus, string>;
  lateSuffix: string;
  unknownUser: string;
  entryCount: (count: number) => string;
  norm: string;
  noAction: string;
  voidedAt: (time: string) => string;
  sheetSummary: (summary: ChecklistSummary) => string;
  limit: (limit: string) => string;
  checkedBy: string;
  signatureDate: string;
  page: (page: number, total: number) => string;
  deviationsTitle: string;
  deviationsEmpty: string;
};

export type JournalPdfProps = {
  labels: JournalPdfLabels;
  organization: string;
  /** "Organization · Location · Period", under every journal's title so a filed sheet stands alone. */
  context: string;
  generatedAt: string;
  documents: JournalDocument[];
  deviations: DeviationRow[] | null;
};

const FONTS = "node_modules/@fontsource";

function fontFile(pkg: string, file: string): string {
  return path.join(process.cwd(), FONTS, pkg, "files", file);
}

function notoWeights(script: "latin" | "cyrillic") {
  return [400, 600, 700].map((fontWeight) => ({
    src: fontFile("noto-sans", `noto-sans-${script}-${fontWeight}-normal.woff`),
    fontWeight,
  }));
}

// Fontsource ships per-script subsets; react-pdf falls back along the family list per glyph.
Font.register({ family: "NotoSans", fonts: notoWeights("latin") });
Font.register({ family: "NotoSansCyrillic", fonts: notoWeights("cyrillic") });
Font.register({
  family: "NotoSansMath",
  fonts: [400, 600, 700].map((fontWeight) => ({
    src: fontFile("noto-sans-math", "noto-sans-math-math-400-normal.woff"),
    fontWeight,
  })),
});
// Hyphenating Bulgarian words mid-cell reads as a typo on paper.
Font.registerHyphenationCallback((word) => [word]);

const FONT_FAMILY = ["NotoSans", "NotoSansCyrillic", "NotoSansMath"];

/** The SafeCheck tokens in print: sRGB of the oklch values the screen uses. */
const C = {
  fg: "#0a0a0a",
  muted: "#6b6b6b",
  border: "#d6e1da",
  rule: "#b1c3b8",
  band: "#195b3b",
  bandSoft: "#bde2cb",
  head: "#e0f7e9",
  headFg: "#104f32",
  zebra: "#f1faf5",
  primary: "#14764a",
  red: "#c10007",
  redTint: "#fbdcdc",
  amberTint: "#f5e2c0",
  amber: "#8a5a00",
  green: "#0d8a4f",
  greyTint: "#ececec",
} as const;

const s = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: C.fg,
    paddingTop: 58,
    paddingBottom: 46,
    paddingHorizontal: 40,
  },
  running: {
    position: "absolute",
    top: 26,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: C.border,
  },
  brand: { fontSize: 10, fontWeight: 700, color: C.primary },
  runningRight: { fontSize: 7.5, color: C.muted },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: C.border,
    fontSize: 7.5,
    color: C.muted,
  },
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.25 },
  subtitle: { fontSize: 9, color: C.muted, marginTop: 3, marginBottom: 16 },
  block: { marginBottom: 16 },
  frame: {
    borderWidth: 0.75,
    borderColor: C.border,
    borderRadius: 6,
  },
  band: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.band,
    borderTopLeftRadius: 5.5,
    borderTopRightRadius: 5.5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  bandTitle: { fontSize: 11.5, fontWeight: 700, color: "#ffffff" },
  bandAside: { fontSize: 7.5, color: C.bandSoft },
  headBlock: {
    backgroundColor: C.head,
    borderBottomWidth: 0.75,
    borderBottomColor: C.border,
  },
  headCell: {
    paddingTop: 5,
    paddingBottom: 4,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontWeight: 600,
    color: C.headFg,
  },
  normCell: {
    paddingBottom: 5,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontWeight: 600,
    color: C.primary,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  cell: { paddingVertical: 4, paddingHorizontal: 6 },
  right: { textAlign: "right", alignItems: "flex-end" },
  date: { fontWeight: 700 },
  note: { fontSize: 8 },
  by: { fontSize: 8, color: C.muted },
  mutedText: { color: C.muted },
  struck: { color: C.muted, textDecoration: "line-through" },
  fail: {
    backgroundColor: C.redTint,
    color: C.red,
    fontWeight: 700,
    borderRadius: 3,
    paddingHorizontal: 3,
    marginHorizontal: -3,
  },
  tag: {
    borderWidth: 0.5,
    borderColor: C.rule,
    borderRadius: 6,
    paddingHorizontal: 4,
    fontSize: 7,
    color: C.muted,
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 0.5,
    fontSize: 7.5,
    fontWeight: 600,
  },
  mark: { flexDirection: "row", alignItems: "center", gap: 3 },
  areaRow: {
    backgroundColor: C.zebra,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    fontWeight: 700,
    color: C.headFg,
  },
  signOff: { flexDirection: "row", marginTop: 30, gap: 24 },
  signLine: {
    borderTopWidth: 0.75,
    borderTopColor: C.fg,
    paddingTop: 4,
    fontSize: 7.5,
    color: C.muted,
  },
});

function widths(fixed: Record<string, number>, flexible: string[]) {
  const used = Object.values(fixed).reduce((sum, value) => sum + value, 0);
  const each = flexible.length === 0 ? 0 : (100 - used) / flexible.length;
  return (key: string) => `${fixed[key] ?? each}%`;
}

type Column = { key: string; label: string; width: string; right?: boolean };

function RunningHeader({ labels, right }: { labels: JournalPdfLabels; right: string }) {
  return (
    <View style={s.running} fixed>
      <Text style={s.brand}>{labels.brand}</Text>
      <Text style={s.runningRight}>{right}</Text>
    </View>
  );
}

function Footer({ left, labels }: { left: string; labels: JournalPdfLabels }) {
  // No lineHeight on the Page: react-pdf then silently drops this render-prop text.
  return (
    <>
      <Text style={s.footer} fixed>
        {left}
      </Text>
      {/* Numbered per journal: each one is filed in its own section of the binder. */}
      <Text
        style={[s.footer, { textAlign: "right", borderTopWidth: 0 }]}
        fixed
        render={({ subPageNumber, subPageTotalPages }) =>
          labels.page(subPageNumber, subPageTotalPages)
        }
      />
    </>
  );
}

function HeadCells({ columns }: { columns: Column[] }) {
  return columns.map((column) => (
    <Text
      key={column.key}
      style={[s.headCell, { width: column.width }, column.right ? s.right : {}]}
    >
      {column.label}
    </Text>
  ));
}

type Band = { title: string; aside?: ReactNode };

/** Fixed inside the table, so a table that runs onto the next page repeats its band and header there. */
function TableHead({ band, children }: { band?: Band; children: ReactNode }) {
  return (
    <View wrap={false} fixed>
      {band === undefined ? null : (
        <View style={s.band}>
          <Text style={s.bandTitle}>{band.title}</Text>
          {band.aside === undefined ? null : band.aside}
        </View>
      )}
      <View
        style={[
          s.headBlock,
          band === undefined ? { borderTopLeftRadius: 5.5, borderTopRightRadius: 5.5 } : {},
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function HeadRow({ columns, band }: { columns: Column[]; band?: Band }) {
  return (
    <TableHead band={band}>
      <View style={{ flexDirection: "row" }}>
        <HeadCells columns={columns} />
      </View>
    </TableHead>
  );
}

function NormAside({ norm, labels }: { norm: string; labels: JournalPdfLabels }) {
  return (
    <Text style={s.bandAside}>
      <Text style={{ fontWeight: 700, color: "#ffffff" }}>{`${labels.norm} `}</Text>
      {norm}
    </Text>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <View style={s.frame}>{children}</View>;
}

/** In a row of its own, so the red tint hugs the value instead of filling the cell. */
function Fail({ children, right = false }: { children: string; right?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: right ? "flex-end" : "flex-start",
      }}
    >
      <Text style={s.fail}>{children}</Text>
    </View>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={s.tag}>{children}</Text>
    </View>
  );
}

function Unanswered({
  status,
  labels,
}: {
  status: "missed" | "open";
  labels: JournalPdfLabels;
}) {
  return (
    <View style={{ flexDirection: "row" }}>
      <Text
        style={[
          s.pill,
          status === "missed"
            ? { backgroundColor: C.amberTint, color: C.amber }
            : { backgroundColor: C.greyTint, color: C.muted },
        ]}
      >
        {labels.status[status]}
      </Text>
    </View>
  );
}

function Icon({ status }: { status: "done" | "fail" | "voided" }) {
  const color = status === "done" ? C.green : status === "fail" ? C.red : C.muted;
  return (
    <Svg viewBox="0 0 24 24" width={8} height={8}>
      {status === "done" ? (
        <Path
          d="M20 6 9 17l-5-5"
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2.5} fill="none" />
          <Path
            d={status === "fail" ? "M12 8v4M12 16h.01" : "m4.9 4.9 14.2 14.2"}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

function StatusMark({
  status,
  labels,
}: {
  status: ReportStatus;
  labels: JournalPdfLabels;
}) {
  if (status === "missed" || status === "open") {
    return <Unanswered status={status} labels={labels} />;
  }
  return (
    <View style={s.mark}>
      <Icon status={status} />
      <Text
        style={
          status === "fail"
            ? { color: C.red, fontWeight: 700 }
            : status === "voided"
              ? s.mutedText
              : { fontWeight: 600 }
        }
      >
        {labels.status[status]}
      </Text>
    </View>
  );
}

function NoAction({ labels }: { labels: JournalPdfLabels }) {
  return <Text style={{ color: C.red, fontWeight: 600 }}>{labels.noAction}</Text>;
}

function GridValue({ cell, labels }: { cell: GridCell | null; labels: JournalPdfLabels }) {
  if (!cell) return null;
  if (cell.text === "") {
    return cell.missed || cell.open ? (
      <Unanswered status={cell.missed ? "missed" : "open"} labels={labels} />
    ) : null;
  }
  return (
    <View style={s.right}>
      {cell.voided ? (
        <Text style={s.struck}>{cell.text}</Text>
      ) : cell.fails ? (
        <Fail right>{cell.text}</Fail>
      ) : (
        <Text>{cell.text}</Text>
      )}
      {cell.late ? <Text style={[s.mutedText, { fontSize: 7 }]}>{labels.lateSuffix}</Text> : null}
    </View>
  );
}

function GridTable({
  grid,
  block,
  title,
  labels,
}: {
  grid: ReadingsGrid;
  block: GridBlock;
  title: string;
  labels: JournalPdfLabels;
}) {
  const timeWidth = grid.times.length > 6 ? 8 : 10;
  const width = widths(
    {
      date: 14,
      by: 18,
      ...Object.fromEntries(grid.times.map((time) => [time, timeWidth])),
    },
    ["action"],
  );
  const columns: Column[] = [
    { key: "date", label: labels.columns.date, width: width("date") },
    ...grid.times.map((time) => ({
      key: time,
      label: time,
      width: width(time),
      right: true,
    })),
    { key: "action", label: labels.columns.correctiveAction, width: width("action") },
    { key: "by", label: labels.columns.by, width: width("by") },
  ];

  return (
    <Frame>
      <HeadRow
        columns={columns}
        band={{
          title,
          aside:
            block.norm === null ? undefined : (
              <NormAside norm={block.norm} labels={labels} />
            ),
        }}
      />
      {block.rows.map((row, index) => {
        const timed = row.correctiveActions.length > 1;
        return (
          <View
            key={row.date}
            style={[
              s.row,
              index % 2 === 1 ? { backgroundColor: C.zebra } : {},
              index === block.rows.length - 1 ? { borderBottomWidth: 0 } : {},
            ]}
            wrap={false}
          >
            <Text style={[s.cell, s.date, { width: width("date") }]}>{row.date}</Text>
            {row.cells.map((cell, cellIndex) => (
              <View
                key={grid.times[cellIndex]}
                style={[s.cell, s.right, { width: width(grid.times[cellIndex]!) }]}
              >
                <GridValue cell={cell} labels={labels} />
              </View>
            ))}
            <View style={[s.cell, s.note, { width: width("action"), gap: 2 }]}>
              {row.correctiveActions.map((action) => (
                <Text key={action.time}>
                  {timed ? <Text style={{ fontWeight: 600 }}>{`${action.time} `}</Text> : null}
                  {action.text ?? ""}
                  {action.text === null ? <NoAction labels={labels} /> : null}
                </Text>
              ))}
              {row.voidedTimes.map((time) => (
                <Tag key={time}>{labels.voidedAt(time)}</Tag>
              ))}
            </View>
            <Text style={[s.cell, s.by, { width: width("by") }]}>
              {row.recordedBy.join(", ")}
            </Text>
          </View>
        );
      })}
    </Frame>
  );
}

function FieldValue({
  row,
  index,
  right = false,
}: {
  row: EntryLogRow;
  index: number;
  right?: boolean;
}) {
  const cell = row.cells[index];
  if (!cell) return null;
  if (row.status === "voided") return <Text style={s.struck}>{cell.text}</Text>;
  return cell.fails ? (
    <Fail right={right}>{cell.text}</Fail>
  ) : (
    <Text>{cell.text}</Text>
  );
}

function ActionText({ row, labels }: { row: EntryLogRow; labels: JournalPdfLabels }) {
  if (row.status === "voided") return <Tag>{labels.status.voided}</Tag>;
  if (row.status === "fail" && row.correctiveAction === null) {
    return <NoAction labels={labels} />;
  }
  return <Text>{row.correctiveAction ?? ""}</Text>;
}

function ByText({ row, labels }: { row: EntryLogRow; labels: JournalPdfLabels }) {
  return (
    <Text>
      {row.recordedBy === undefined ? "—" : (row.recordedBy ?? labels.unknownUser)}
    </Text>
  );
}

/** One row per check; a day's checks share one shaded band and print the date once. */
function LogTable({
  fields,
  group,
  labels,
}: {
  fields: EntryLogColumn[];
  group: EntryLogGroup;
  labels: JournalPdfLabels;
}) {
  const width = widths(
    { date: 12, time: 8, action: 22, by: 13 },
    fields.map((field) => field.fieldId),
  );
  const columns: Column[] = [
    { key: "date", label: labels.columns.date, width: width("date") },
    { key: "time", label: labels.columns.time, width: width("time") },
    ...fields.map((field) => ({
      key: field.fieldId,
      label: field.label,
      width: width(field.fieldId),
      right: field.numeric,
    })),
    { key: "action", label: labels.columns.correctiveAction, width: width("action") },
    { key: "by", label: labels.columns.by, width: width("by") },
  ];
  const hasNorms = group.norms.some((norm) => norm !== null);
  const fieldsWidth = `${fields.reduce((sum, field) => sum + Number.parseFloat(width(field.fieldId)), 0)}%`;

  return (
    <Frame>
      <TableHead
        band={group.targetName === null ? undefined : { title: group.targetName }}
      >
        <View style={{ flexDirection: "row" }}>
          <HeadCells columns={columns} />
        </View>
        {hasNorms ? (
          <View style={{ flexDirection: "row" }}>
            <Text style={[s.normCell, { width: `${Number.parseFloat(width("date")) + Number.parseFloat(width("time"))}%`, color: C.headFg, fontWeight: 400 }]}>
              {labels.norm}
            </Text>
            {group.norms.map((norm, index) => (
              <Text
                key={fields[index]!.fieldId}
                style={[s.normCell, { width: width(fields[index]!.fieldId) }, fields[index]!.numeric ? s.right : {}]}
              >
                {norm ?? ""}
              </Text>
            ))}
          </View>
        ) : null}
      </TableHead>
      {group.days.map((day, dayIndex) => (
        <View
          key={day.date}
          wrap={false}
          style={[
            dayIndex % 2 === 1 ? { backgroundColor: C.zebra } : {},
            dayIndex === group.days.length - 1 ? {} : { borderBottomWidth: 0.75, borderBottomColor: C.border },
          ]}
        >
          {day.rows.map((row, rowIndex) => {
            const unanswered = row.status === "missed" || row.status === "open";
            return (
              <View
                key={row.id}
                style={[
                  { flexDirection: "row" },
                  rowIndex === day.rows.length - 1
                    ? {}
                    : { borderBottomWidth: 0.5, borderBottomColor: C.border },
                ]}
              >
                <Text style={[s.cell, s.date, { width: width("date") }]}>
                  {rowIndex === 0 ? day.date : ""}
                </Text>
                <View style={[s.cell, { width: width("time"), gap: 2 }]}>
                  <Text style={s.mutedText}>{row.time}</Text>
                  {row.late ? <Tag>{labels.lateSuffix}</Tag> : null}
                </View>
                {unanswered ? (
                  <View style={[s.cell, { width: fieldsWidth }]}>
                    <Unanswered status={row.status as "missed" | "open"} labels={labels} />
                  </View>
                ) : (
                  fields.map((field, index) => (
                    <View
                      key={field.fieldId}
                      style={[s.cell, { width: width(field.fieldId) }, field.numeric ? s.right : {}]}
                    >
                      <FieldValue row={row} index={index} right={field.numeric} />
                    </View>
                  ))
                )}
                <View style={[s.cell, s.note, { width: width("action") }]}>
                  <ActionText row={row} labels={labels} />
                </View>
                <View style={[s.cell, s.by, { width: width("by") }]}>
                  <ByText row={row} labels={labels} />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Frame>
  );
}

function ChecklistTable({
  fields,
  sheet,
  labels,
}: {
  fields: EntryLogColumn[];
  sheet: ChecklistSheet;
  labels: JournalPdfLabels;
}) {
  const width = widths(
    { item: 22, result: 14, action: 20, by: 15 },
    fields.map((field) => field.fieldId),
  );
  const columns: Column[] = [
    { key: "item", label: labels.columns.item, width: width("item") },
    ...fields.map((field) => ({
      key: field.fieldId,
      label: field.label,
      width: width(field.fieldId),
    })),
    { key: "result", label: labels.columns.result, width: width("result") },
    { key: "action", label: labels.columns.correctiveAction, width: width("action") },
    { key: "by", label: labels.columns.by, width: width("by") },
  ];

  return (
    <View style={s.block}>
      <Frame>
        <HeadRow
          columns={columns}
          band={{
            title: `${sheet.date} · ${sheet.time}`,
            aside: <Text style={s.bandAside}>{labels.sheetSummary(sheet.summary)}</Text>,
          }}
        />
        {sheet.groups.map((group) => (
          <View key={group.area ?? ""}>
            {group.area === null ? null : (
              <Text style={s.areaRow} minPresenceAhead={20}>
                {group.area}
              </Text>
            )}
            {group.rows.map((row) => {
              const unanswered = row.status === "missed" || row.status === "open";
              return (
                <View key={row.id} style={s.row} wrap={false}>
                  <Text
                    style={[
                      s.cell,
                      { width: width("item") },
                      group.area === null ? {} : { paddingLeft: 16 },
                    ]}
                  >
                    {row.itemName}
                  </Text>
                  {fields.map((field, index) => (
                    <View key={field.fieldId} style={[s.cell, { width: width(field.fieldId) }]}>
                      {unanswered ? (
                        <Text style={s.mutedText}>—</Text>
                      ) : (
                        <FieldValue row={row} index={index} />
                      )}
                    </View>
                  ))}
                  <View style={[s.cell, { width: width("result"), gap: 2 }]}>
                    <StatusMark status={row.status} labels={labels} />
                    {row.late ? <Tag>{labels.lateSuffix}</Tag> : null}
                  </View>
                  <View style={[s.cell, s.note, { width: width("action") }]}>
                    {row.status === "fail" && row.correctiveAction === null ? (
                      <NoAction labels={labels} />
                    ) : (
                      <Text>{row.correctiveAction ?? ""}</Text>
                    )}
                  </View>
                  <View style={[s.cell, s.by, { width: width("by") }]}>
                    <ByText row={row} labels={labels} />
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Frame>
    </View>
  );
}

function JournalBody({
  document,
  labels,
}: {
  document: JournalDocument;
  labels: JournalPdfLabels;
}) {
  const body = document.body;

  if (body.shape === JOURNAL_SHAPE.GRID) {
    return (
      <View>
        {body.grid.blocks.map((block) => (
          <View key={block.key} style={s.block} minPresenceAhead={80}>
            <GridTable
              grid={body.grid}
              block={block}
              title={block.targetName ?? document.name}
              labels={labels}
            />
          </View>
        ))}
      </View>
    );
  }

  if (body.shape === JOURNAL_SHAPE.CHECKLIST) {
    return (
      <View>
        {body.checklist.sheets.map((sheet) => (
          <ChecklistTable
            key={sheet.key}
            fields={body.checklist.columns}
            sheet={sheet}
            labels={labels}
          />
        ))}
      </View>
    );
  }

  return (
    <View>
      {body.log.groups.map((group) => (
        <View key={group.key} style={s.block} minPresenceAhead={80}>
          <LogTable fields={body.log.columns} group={group} labels={labels} />
        </View>
      ))}
    </View>
  );
}

function JournalPage({
  document,
  index,
  props,
}: {
  document: JournalDocument;
  index: number;
  props: JournalPdfProps;
}) {
  const { labels } = props;

  return (
    <Page
      size="A4"
      orientation={document.wide ? "landscape" : "portrait"}
      style={s.page}
      wrap
    >
      <RunningHeader
        labels={labels}
        right={`${labels.title} · ${labels.position(index + 1, props.documents.length)}`}
      />
      <Footer
        labels={labels}
        left={`${props.organization} · ${document.name} · ${props.generatedAt}`}
      />
      <Text style={s.title}>{document.name}</Text>
      <Text style={s.subtitle}>
        {`${props.context} · ${labels.entryCount(document.summary.total)}`}
      </Text>
      <JournalBody document={document} labels={labels} />
      <View style={s.signOff} wrap={false}>
        <Text style={[s.signLine, { flex: 2 }]}>{labels.checkedBy}</Text>
        <Text style={[s.signLine, { flex: 1 }]}>{labels.signatureDate}</Text>
      </View>
    </Page>
  );
}

function EmptyPage({ props }: { props: JournalPdfProps }) {
  const { labels } = props;
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader labels={labels} right={labels.title} />
      <Footer labels={labels} left={`${props.organization} · ${props.generatedAt}`} />
      <Text style={s.title}>{labels.empty.title}</Text>
      <Text style={s.subtitle}>{props.context}</Text>
      <Text>{labels.empty.description}</Text>
    </Page>
  );
}

function failedText(row: DeviationRow, labels: JournalPdfLabels): string {
  return row.failed
    .map((answer) =>
      answer.limit === null
        ? `${answer.label}: ${answer.text}`
        : `${answer.label}: ${answer.text} (${labels.limit(answer.limit)})`,
    )
    .join("; ");
}

function DeviationsPage({
  props,
  rows,
}: {
  props: JournalPdfProps;
  rows: DeviationRow[];
}) {
  const { labels } = props;
  const width = widths({ date: 10, time: 6, task: 22, action: 24, by: 13 }, ["failed"]);

  return (
    <Page size="A4" orientation="landscape" style={s.page} wrap>
      <RunningHeader labels={labels} right={labels.deviationsTitle} />
      <Footer labels={labels} left={`${props.organization} · ${props.generatedAt}`} />
      <Text style={s.title}>{labels.deviationsTitle}</Text>
      <Text style={s.subtitle}>{props.context}</Text>
      {rows.length === 0 ? (
        <Text>{labels.deviationsEmpty}</Text>
      ) : (
        <Frame>
          <HeadRow
            columns={[
              { key: "date", label: labels.columns.date, width: width("date") },
              { key: "time", label: labels.columns.time, width: width("time") },
              { key: "task", label: labels.columns.task, width: width("task") },
              { key: "failed", label: labels.columns.whatFailed, width: width("failed") },
              {
                key: "action",
                label: labels.columns.correctiveAction,
                width: width("action"),
              },
              { key: "by", label: labels.columns.by, width: width("by") },
            ]}
          />
          {rows.map((row, index) => (
            <View
              key={row.id}
              style={[
                s.row,
                index % 2 === 1 ? { backgroundColor: C.zebra } : {},
                index === rows.length - 1 ? { borderBottomWidth: 0 } : {},
              ]}
              wrap={false}
            >
              <Text style={[s.cell, s.date, { width: width("date") }]}>{row.date}</Text>
              <Text style={[s.cell, s.mutedText, { width: width("time") }]}>{row.time}</Text>
              <Text style={[s.cell, { width: width("task") }]}>
                {row.targetName === null ? row.title : `${row.title} · ${row.targetName}`}
              </Text>
              <Text style={[s.cell, { width: width("failed"), color: C.red, fontWeight: 600 }]}>
                {failedText(row, labels)}
              </Text>
              <View style={[s.cell, s.note, { width: width("action") }]}>
                {row.correctiveAction === null ? (
                  <NoAction labels={labels} />
                ) : (
                  <Text>{row.correctiveAction}</Text>
                )}
              </View>
              <Text style={[s.cell, s.by, { width: width("by") }]}>
                {row.recordedBy ?? labels.unknownUser}
              </Text>
            </View>
          ))}
        </Frame>
      )}
    </Page>
  );
}

export function JournalPdf(props: JournalPdfProps) {
  return (
    <Document title={props.labels.documentTitle} creator={props.labels.brand}>
      {props.documents.length === 0 ? <EmptyPage props={props} /> : null}
      {props.documents.map((document, index) => (
        <JournalPage key={document.id} document={document} index={index} props={props} />
      ))}
      {props.deviations === null ? null : (
        <DeviationsPage props={props} rows={props.deviations} />
      )}
    </Document>
  );
}

export function renderJournalPdf(props: JournalPdfProps): Promise<Buffer> {
  return renderToBuffer(<JournalPdf {...props} />);
}
