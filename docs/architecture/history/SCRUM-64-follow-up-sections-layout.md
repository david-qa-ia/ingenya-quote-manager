# SCRUM-64 Follow-up Sections Layout

The quote summary keeps its existing quote actions, service detail and calculated total unchanged.
Document data is presented separately from commercial data. The document section identifies the
client and work/reference text that appear in the quote and PDF, and explains that finalization
freezes those texts. Commercial information follows the detail as full-width cards in this order:

1. Next action, when the selected work record has one.
2. Contact and work-in-progress record.
3. One commercial follow-up card, with commercial status first and activities and follow-up after
   an accessible visual divider.

The prior tabbed sidebar is removed. The card order is also the document order, so keyboard and
screen-reader navigation follows the visible flow. The commercial follow-up card has one eyebrow
and one primary heading; its subsections use their own headings without repeating that eyebrow.
Cards stack at every viewport width; the existing controls retain their focus styles and
responsive behavior.

This is a presentation-only change. It does not alter quote calculations, PDF output, storage,
contact restrictions, consent checks, pending contact display, or finalized-quote protections.

## Consolidated Follow-up

The separate quote, client and work-record timelines are consolidated into one chronological
timeline. Every entry retains its subject and shows it as a secondary label. New manual entries
continue to be recorded against the quote, so no activity data or storage contract changes.

The unified timeline has one primary "Registrar actividad" action. Its complete history is visible
by default, while activity filters and cadence tools are available through secondary disclosure
controls. Contact preparation was removed from duplicate timeline, contact-record and cadence
locations. It remains available from a supported next action and, when eligibility rules allow it,
from the compact contact record.

## Contact And Work Record

The contact and work record is a single compact card for commercial context. Its visible area
contains only the relevant contact and work information, with two columns on desktop and a
stacked layout on mobile. A work record is optional: it exists only to group multiple quotes that
share commercial follow-up. Contact administration and work administration are separate collapsed
disclosures. Association selectors, forms, outcomes and related quotes stay in their respective
disclosure; cadence templates and configuration remain only in their global view.

The visible contact actions are limited to preparing an eligible contact and viewing its record.
When no contact is linked, the empty state explains that the quote may continue and exposes only
the primary association and secondary creation actions. The existing validation and contact
eligibility rules still determine whether contact preparation is available.

## Work Record Terminology

The user-facing label for the reusable technical `Opportunity` entity is "Obra o trabajo en
seguimiento". It is optional and does not change the document's "Cliente en el presupuesto" or
"Obra / referencia" snapshot. When present, the compact record shows its name, responsible
seller, next step and linked-quote count; its administration remains collapsed by default.

When no contact is linked, the visible card contains only the no-contact title, its explanatory
text and the three equivalent next actions: associate a contact, create one, or continue without
one. No selectors, forms or collapsed controls are rendered until the user requests contact
administration.

## Validation

On 2026-10-15, `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, and
`git diff --check` completed successfully. The test suite reported 167 passing tests and one
intentional skip. The production build completed with Vite's existing chunk-size advisory.

Manual desktop and mobile browser review remains pending because no browser surface was available
in the execution environment.
