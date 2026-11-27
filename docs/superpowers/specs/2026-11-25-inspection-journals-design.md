# Inspection journals — design

## Intent

Inspectors (БАБХ) read **printed binders on site**. The records report must print journals that an
inspector can scan the way they scan the paper forms a food technologist gave us: one journal per
check, the norm stated up top, gaps obvious, every deviation paired with what was done about it,
and a place for the HACCP lead to sign. Exact paper layouts are reference, not a requirement.

## Goals

- Each journal picks one of three shapes from the form itself — no user setting:
  - **Readings grid** — a single field: rows are days, columns are check times; one block per
    item. Fridges, freezers, sterilizer.
  - **Daily checklist** — one sheet per day (and time), rows are items grouped under their area,
    columns are the questions. Cleaning & disinfection, equipment, sanitary rooms.
  - **Entry log** — one row per check, a day's checks under one date, a "Norm" row under the
    field names. Several fields per check, on-demand checks, and more times than a grid holds.
- Journal header: name and "Organization · Location · Period · N entries" (the location only when
  the business has more than one). No edition and no contents page: the PDF opens on the first
  journal. Each item states its own norm (its limits, else the form's).
- Everything sits on the row, with no legend or notes: a failing value is a red tag, a missed
  check a "Missed" tag, a voided record is struck through and tagged, and the corrective action
  has its own column.
- A blank "Checked by (HACCP lead) / Date" line on every journal for a wet signature.
- A server-generated PDF: repeated page header, page X of Y per journal, landscape per journal
  when wide. The HTML report stays as the on-screen preview.

## Non-goals (this phase)

- Recreating paper layouts cell-for-cell, or legend codes like П/И/Д.
- PDFs for the "list" and "deviations-only" report layouts — they stay browser-printed.
- A stored, frozen monthly archive (needs storage + sign-off; later phase).

## Anti-goals

- A report that hides a missed or failed check, or re-judges a stored answer.
- Options or toggles for the shape.

## Approach (chosen)

Renderer-agnostic journal model as pure functions in `features/records-report/lib/`, consumed by
both the HTML preview and a PDF built with `@react-pdf/renderer` in a Next.js route handler
(reuses next-intl messages and answer formatters; no browser in the server). Rejected: headless
Chromium on Vercel (bundle size, cold start, auth hop to load the page); continuing with browser
print only (no page numbers, named pages unreliable outside Chromium, depends on print settings).

## Shape rule (builder's call)

Using the newest form version in the period:
1. `onDemand` → entry log.
2. `per_item`, no measurement field, ≥ 2 items in the period → daily checklist.
3. check times × fields ≤ 8 and no multiline text field → readings grid.
4. Otherwise → entry log.

## Data changes

- `FormVersionSummary` gains `appliesTo`, `onDemand` and `publishedAt` (version `created_at`).

## Later phases (each its own PR, design calls to confirm)

1. **Form code** — optional short code on the form (`ФРП 03-11`), printed in the header.
2. **Corrective action outcome** — a follow-up on a deviation: effective / not, note, who, when;
   shown as "Result of corrective action" in the deviation notes.
3. **Electronic sign-off** — an admin marks a journal (form × location × month) as checked; the
   print fills the signature line with name and time.
4. **Frozen archive** — on sign-off, store that month's PDF and list closed months per journal.
