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

Changing a unit price in one quote must not automatically change the catalog price.

## Quote Line Rules

A quote line represents one service added to a quote.

Each quote line must have:

- `id`
- optional `catalogJobId`
- `name`
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
