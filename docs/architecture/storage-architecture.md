# Storage Architecture

This document defines how Ingenya Quote Manager stores quote data in the browser.

## Storage Scope

The app currently uses browser localStorage as temporary frontend-only persistence.

This is not a backend, database, login system, user system, or multi-device sync mechanism.

## Storage Keys

Current saved quotes collection key:

`ingenya.savedQuotes.v1`

Previous single-draft key:

`ingenya.quoteDraft.v1`

Labor catalog key:

`ingenya.laborCatalog.v1`

The labor catalog is stored independently from quotes. When its key does not exist, the app
persists a copy of the static seed. Invalid root data is never silently overwritten: the app uses
the seed as an in-memory recovery and reports the problem. When a stored array contains a mix of
valid and invalid entries, only the valid entries are loaded and the discarded seed entries are not
reintroduced automatically.

New saved quote behavior should use the collection key.

## Persisted Data

A saved quote may persist:

- Quote ID.
- Status.
- Optional client name.
- Optional project/work name.
- Quote lines.
- Saved date.

The current MVP status contract and the transition approved by SCRUM-37 are documented in
[`quote-status.md`](./quote-status.md). This is a newer, increment-specific decision; historical
specifications that excluded `finalized` remain unchanged.

Quote lines may persist:

- Line ID.
- Catalog job ID, when the line comes from the catalog.
- Name.
- Optional description.
- Work unit.
- Quantity.
- Unit price.
- Source.

## Derived Data

The app must not persist derived totals.

Do not persist:

- Line subtotal.
- Quote total.
- Formatted currency values.

These values must be recalculated from quote lines using:

- `calculateLineSubtotal`
- `calculateQuoteTotal`

## Validation Rules

Any data recovered from localStorage must be treated as unknown input.

The app must validate:

- Root structure.
- Quote IDs.
- Status values.
- Client/project fields.
- Quote line shape.
- Work unit values.
- Source values.
- Positive quantity.
- Finite unit price greater than or equal to zero.

Invalid saved quotes must be ignored without breaking the app.

A corrupt saved quote must not make the whole collection unusable if other saved quotes are valid.

## User Behavior

“Guardar borrador” creates or updates the current saved quote.

“Nuevo presupuesto” starts a clean quote with a new ID.

“Presupuestos guardados” shows saved quotes and lets the user open one.

Opening a saved quote loads it into the editor.

## Current Limitations

The app does not support:

- Backend persistence.
- Database storage.
- User accounts.
- Multi-device sync.
- Quote history.
- Quote versioning.
- WhatsApp/email delivery.
- Deleting saved quotes.
- Duplicating saved quotes.
- Advanced search or filters beyond the local status filters approved by SCRUM-38.

Each of these requires its own Jira ticket.

## Agent Rules

Before modifying storage behavior, agents must read:

- `docs/architecture/product-rules.md`
- `docs/architecture/coding-rules.md`
- `docs/architecture/testing-rules.md`
- `docs/architecture/storage-architecture.md`

Agents must not introduce new storage keys, persistence mechanisms, backend assumptions, or duplicated derived totals without an explicit Jira ticket.

SCRUM-40 explicitly authorizes `ingenya.laborCatalog.v1` for the local labor catalog.

## SCRUM-46 Compatible Extension

Approved specification: [Clients, opportunities and responsible seller](https://docs.google.com/document/d/1UWtAjAoOcGyXfVp9nTEVZ_DPLhsFM_sbvciaL5u9ZjM/edit).

New independent array collections:

- `ingenya.clients.v1`: `id`, `name`, `phone`, `email`, `preferredChannel`, `contactConsent`,
  `createdAt`, `updatedAt`.
- `ingenya.opportunities.v1`: `id`, `clientId`, `name`, `address`, `estimatedStartDate`,
  `responsibleSeller`, `createdAt`, `updatedAt`.

The saved quote collection remains `ingenya.savedQuotes.v1`. Optional `clientId` and
`opportunityId` are additive fields. No root envelope, totals, seller snapshot, commercial
status or duplicated opportunity data is added. Existing quotes need no rewrite or new ID.
Dates on entities use ISO timestamps; an estimated start date is empty or a valid `YYYY-MM-DD`.

### Migration And Recovery

Migration is read-time, pure and idempotent: accept legacy quotes without references, remove
malformed optional references in memory and preserve the rest of the valid quote. It generates
no entities, IDs or timestamps and makes no storage writes. Names and contacts never establish
identity. Distinct IDs remain distinct even when all names and contacts match.

Well-formed references to missing entities are retained. Display a missing-association warning
and the historical document snapshots. A mismatched opportunity is not displayed as the client's
opportunity. New associations must use an opportunity belonging to the selected client.
Existing opportunities cannot be moved between clients in this increment.

Unknown storage input is validated per record. Mixed collections recover valid records without
failing the rest of the application. Duplicate IDs expose only the first valid record in memory;
writes to an ambiguous ID are rejected. Reads never remove invalid records from storage.
Subsequent writes preserve unrelated invalid records for recovery. Invalid JSON/root data or
read failures must not be replaced with an empty collection on save. Write failures return an
error and the UI does not claim success. Missing collections start empty without automatic writes.

The old single-draft key `ingenya.quoteDraft.v1` remains untouched and is not automatically
imported. It was already outside the active loader before SCRUM-46; its format lacks `savedAt`.

### Writes And Historical Integrity

Create/save the client before its opportunity, and save the quote association only on explicit
draft save or finalization. Each write is independent; localStorage provides no cross-key
transaction. If saving a later step fails, an already saved client/opportunity remains reusable.
Retry updates by stable ID rather than creating alternatives with the same quote ID.

Client and opportunity writes serialize only their approved fields and never write quotes.
An already finalized saved quote rejects every update, including association-only changes and
attempts to return to draft. Finalization of a draft preserves its optional references and
document snapshots. Several quotes may share the same opportunity without replacing one another.

There is no automatic cross-tab conflict resolution, backup service or rollback to older app
versions. An older application build can discard fields it does not understand when saving;
do not use older builds to edit data created by this increment.

## SCRUM-47 Compatible Extension

Saved quotes retain their `status` document field and add `commercialStatus`,
`commercialStatusAudit` and optional `sentAudit` in the existing
`ingenya.savedQuotes.v1` collection. No storage key, totals, document versions or event timeline
is introduced.

Quotes without commercial fields recover as `prepared` with a compatibility audit based on their
existing `savedAt`; this is pure, idempotent and does not write storage. A dedicated write may
change only commercial metadata on a finalized quote. It preserves every document field and the
existing `savedAt` value. Normal quote writes remain unable to overwrite a finalized quote.

## SCRUM-48 Compatible Extension

`ingenya.activities.v1` is an independent activity collection. Each valid activity stores its
identity, type, occurrence date and time, author, result, note, unique client/opportunity/quote
subject, origin and append-only note revisions. It never becomes part of a saved quote and cannot
change quote lines, totals, document snapshots, associations or document/commercial status.

Missing activity storage recovers as an empty in-memory collection without a write. Invalid roots
are never overwritten; mixed arrays recover valid activities and retain unrelated invalid records
on later writes. Historical activity subjects whose entities no longer load remain valid IDs and
are shown as unavailable context rather than being removed.

`ingenya.activityAuthor.v1` stores the locally configured current author. It is a browser-local
preference, not a user account or authorization system. A note revision is accepted only when its
author matches the original manual activity author; every prior revision remains persisted.

## SCRUM-53 Compatible Extension

`ingenya.commercialOutcomes.v1` is an append-only collection of commercial outcome records.
Each record has an ID, result type, optional typed reason and note, timestamp, author, origin,
opportunity reference, optional quote reference and optional reference to the result it corrects.
Results are never edited or deleted; corrections and reopenings are new records.

Opportunities retain only `commercialState` (`open`, `won` or `lost`) and
`currentCommercialOutcomeId`. Reason, author, note and timestamp remain in the outcome collection.
Legacy opportunities recover as `open`; the pre-existing operational `status` is preserved and is
not mapped automatically.

Commercial outcomes may update only commercial metadata of a finalized quote through the existing
dedicated operation. They never change quote lines, prices, totals, document snapshots,
associations or document status. Closing a won opportunity or marking one lost cancels associated
active and paused cadences and pending actions; every cancellation records an automatic activity.

## SCRUM-56 to SCRUM-60 Compatible Extension

`ingenya.prospects.v1` is an independent local collection for pre-first-contact prospects. It is
not a client, contact, opportunity or saved quote collection, and an `interested` prospect stays
there until the explicitly separate SCRUM-61 conversion work. Its validated records retain
identity, contact fields, commercial source/service context, explicit priority and reason,
next-action data, state and an append-only prospect activity history. Pending contact values use
the same rules as clients and are never usable destinations.

`ingenya.prospectFilters.v1` is a browser-local navigation preference for the prospect list; it
contains no business record. Both keys recover missing data as empty/default state and never
replace malformed roots during a write.
