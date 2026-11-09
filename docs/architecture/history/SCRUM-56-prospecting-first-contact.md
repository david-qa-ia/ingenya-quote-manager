# SCRUM-56 to SCRUM-60: Prospecting and first contact

## Boundary

A prospect is a pre-first-contact commercial record. It is deliberately independent from a
client, contact, quote and opportunity ("obra o trabajo en seguimiento"). Marking a prospect
as interested only changes its prospect status. No conversion is implemented here; that belongs
to SCRUM-61.

## Storage and recovery

Prospects use the independent `ingenya.prospects.v1` localStorage array. A record contains raw
contact information, source, potential service, notes, visible state and priority, next action,
responsible person and an append-only prospect activity timeline. `ingenya.prospectFilters.v1`
only stores the user's list filters. Both are browser-local convenience data, not a backend or
shared customer database.

The collection is validated per record on load using the same telephone and pending-value rules
as clients: `1111111111` and `none` are retained as pending confirmation but never exposed as
usable contact destinations. Invalid roots are not overwritten and mixed collections retain valid
records. Writes preserve unrelated malformed records through the shared collection helper.

## Import and deduplication

The CSV preview accepts Spanish or English field headers and gives each row a valid, invalid or
duplicate result before the user confirms. Valid rows persist only on confirmation. Duplicates
are detected against saved records and against earlier valid rows in the same import by normalized
email, normalized phone, or normalized `empresa + nombre`. Pending email/phone placeholders do
not create contact destinations or duplicate matches.

The UI reads a locally selected `.csv` file through the browser File API; no file leaves the
browser and no CSV dependency is required. It supports the canonical headers `name`, `company`,
`phone`, `email`, `source`, `potentialService` and `notes`, including quoted commas and escaped
quotes. Cancelling the import or the manual creation view does not write prospects.

## States and priority

Visible states are `Sin contactar`, `Contactar hoy`, `Contactado`, `Sin respuesta`, `Interesado`,
`No interesado` and future-facing `Convertido`. Every manual status change preserves all fields
and appends a timestamped activity. Priority is explicitly high, medium or low plus a visible
reason. The daily inbox sorts by that manual priority and then by next-action date; it never uses
an opaque score.

## UI flow

The Prospectos area exposes import, filters and a compact `A quién contactar hoy` inbox grouped
as Vencidos, Hoy and Próximos. The prospect sheet has editable data, a timeline (with an explicit
empty state), a deterministic editable first-contact template and a result recorder. Manual
creation contains only the seven identifying/context fields and automatically sets `Sin contactar`;
priority, state and next-action controls appear only after saving. Recording a
result updates status and the timeline only; it does not call, open WhatsApp/email, send content
or create a client/opportunity.

The individual sheet opens in read-only mode, with an explicit edit action for prospect data.
The visible state is a header badge and changes through the registered contact result, never via
a competing list of state buttons. The full-width history remains recent-first and compact.
