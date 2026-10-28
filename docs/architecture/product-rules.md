# Product Rules

This document defines the product boundaries for Ingenya Quote Manager.

## Product Purpose

Ingenya Quote Manager helps Daniel create clear construction service quotes for his clients.

The first version focuses on charging labor/services, not managing workers.

## Meaning Of Labor

In this project, "labor" means a service item charged to the final client.

Examples:

- Build wall
- Paint wall
- Install door
- Install baseboard

"Labor" does not mean:

- Workers
- Employee wages
- Salaries
- Daily rates
- Union categories
- UOCRA rates
- Construction chamber salary tables

## Supported Units

The allowed units are:

- Square meter: `squareMeter`, shown as `m²`
- Linear meter: `linearMeter`, shown as `ml`
- Unit: `unit`, shown as `u`

No other units should be added unless a Jira ticket updates this document.

## Catalog Job Rules

A catalog job represents a predefined service Daniel can choose when building a quote.

Each catalog job must have:

- `id`
- `name`
- `unit`
- `defaultPrice`
- optional `description`
- `isActive`

The default price is only a starting value. The user may edit the unit price inside a quote.

Catalog default prices must be finite and greater than zero. Quote line prices remain valid when
they are finite and greater than or equal to zero.

Changing a unit price in one quote must not automatically change the catalog price.

## Quote Line Rules

A quote line represents one service added to a quote.

Each quote line must have:

- `id`
- optional `catalogJobId`
- `name`
- optional `description`
- `unit`
- `quantity`
- `unitPrice`
- `source`

The source must identify whether the line came from the catalog or was added manually.

## Calculation Rules

Subtotal is calculated as:

```text
quantity * unitPrice
```

## Clients And Opportunities (SCRUM-46)

Clients and opportunities are reusable local entities. A quote may have no association, a
client only, or a client and one of that client's opportunities. Several independent quotes
may reference the same opportunity; identity and updates always use the quote ID.

Client name, phone and email are required. `1111111111` and `none` mean pending confirmation,
never usable contact destinations. Preferred channel is empty, `phone`, `whatsapp` or `email`;
contact consent starts as false. This increment does not send communications.

Opportunity name and client are required. Address, estimated start date and responsible seller
are optional. The seller is text, initially empty; there are no users or permissions.

`clientName` and `projectName` remain document snapshots. Initial selection in a new quote
copies the names. Manual association of an already saved draft preserves its existing texts;
the user may explicitly edit those document texts while it remains a draft. The explicit
"Cambiar oportunidad" action on a saved draft is an exception: it refreshes both document
snapshots from the newly selected client and opportunity, because the user has explicitly
replaced the commercial context. Editing a client or opportunity never updates saved quote
snapshots automatically. Finalized quotes cannot be edited or associated retrospectively. The
current responsible seller is resolved from the opportunity, not copied into the quote or PDF.

Commercial statuses, follow-up, messaging, backend persistence and synchronization remain
outside this increment. `draft` and `finalized`, service lines, calculations and PDF behavior
are unchanged.

## Commercial Statuses (SCRUM-47)

Document status and commercial status are independent. Finalizing or downloading a PDF does not
mean a quote was sent. Commercial changes are manually confirmed records; they do not send a
message or infer a contact action. The pending contact values `1111111111` and `none` are never
contact destinations.

Finalized documents remain immutable. Later commercial changes may update only commercial
metadata through the approved storage operation. Contact history, next actions, reminders,
cadences, metrics and AI remain outside this increment.
