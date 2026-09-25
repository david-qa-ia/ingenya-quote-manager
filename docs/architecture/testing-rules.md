# Testing Rules

This document defines testing expectations for Ingenya Quote Manager.

## Testing Purpose

Tests protect business rules and prevent regressions when humans or AI agents change the code.

The first priority is testing deterministic business logic before UI behavior.

## Unit Tests

Use unit tests for:

- Quote subtotal calculations.
- Quote total calculations.
- Domain helpers.
- Data transformation functions.
- Validation helpers.

Unit tests should be fast and deterministic.

## UI Tests

UI tests should be added when the app has meaningful user flows.

Future UI tests should cover:

- Adding a catalog service to a quote.
- Adding a manual service to a quote.
- Editing unit price.
- Editing quantity.
- Checking subtotals and total.
- Continuing to the next quote step.

Playwright can be added in a future ticket when the UI flow exists.

## Test Naming

Test descriptions should explain behavior, not implementation details.

Good:

```text
adds the subtotal of every quote line
```

Avoid:

```text
calls reduce correctly
```

## Required Checks

Before opening or merging a pull request, run:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

GitHub Actions must run the same quality checks.

## Failure Rules

If a test fails, fix the cause.

Do not:

- Delete tests to make CI pass.
- Skip tests without a documented reason.
- Merge while tests are failing.
- Change expected values without checking the business rule.
