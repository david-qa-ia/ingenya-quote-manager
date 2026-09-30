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
