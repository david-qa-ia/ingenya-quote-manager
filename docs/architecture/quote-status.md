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
