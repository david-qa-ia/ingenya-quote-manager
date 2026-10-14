# Quote Status Contract

This document records the status contract approved for SCRUM-37.

## Current MVP Contract

The supported quote statuses are:

- `draft`
- `finalized`

The only permitted transition in this increment is:

```text
draft -> finalized
```

A finalized quote is read-only. It cannot return to draft or be edited directly.

Both statuses use the existing `ingenya.savedQuotes.v1` collection. Finalization must not add
new storage keys, persisted totals, version history, or a `finalizedAt` field.

Unit prices may be zero. Quantities must be finite and greater than zero.

## Scope And Precedence

SCRUM-37 is the approved implementation specification for this increment. It supersedes only
the earlier restrictions that excluded a finalized status from the MVP.

Future commercial statuses such as `sent`, `accepted`, `rejected`, or `archived` remain outside
this increment. Historical documents are intentionally left unchanged.

## Commercial Status Extension (SCRUM-47)

The `status` field remains the document status and keeps the `draft | finalized` contract above.
Commercial status is stored separately and never changes a document snapshot, its lines,
associations, calculated total or document status.

Supported commercial statuses are `prepared`, `sent`, `followingUp`, `accepted`, `rejected`,
`expired` and `paused`. New and historical quotes start as `prepared`; historical recovery is
read-time only and does not write localStorage automatically.

`sent`, `accepted` and `rejected` require a finalized document. Each commercial change records
the date, free-text actor and reason. The latest change is retained, as is the sent audit when a
quote later enters follow-up. This is not a contact history or event timeline.

`accepted`, `rejected` and `expired` are closed states in the current interface. Their audited
reopening is deliberately deferred to SCRUM-53 or a later approved increment.
