# Testing Rules

This document defines testing expectations for Ingenya Quote Manager.

## Testing Purpose

Tests protect business rules and prevent regressions when humans or AI agents change the code.

The first priority is testing deterministic business logic before UI behavior.

Tests are not a goal by themselves. Do not add tests only to increase the test count or a coverage percentage. A smaller set of tests that protects meaningful behavior is preferable to a large set of low-value tests.

## Test Scope

Every test should map to at least one of these reasons:

- A business rule.
- An acceptance criterion.
- An important edge case.
- A regression risk.

Before adding a test, identify which reason it protects. If none applies, the test is probably outside the useful scope of the change.

Prefer tests that verify observable inputs and outputs through the public API of the code under test. Tests should remain valid when implementation details change but behavior stays the same.

Do not test:

- Private implementation details that callers cannot observe.
- The internal sequence of helper calls when the result is what matters.
- Framework or library behavior already covered by that dependency.
- Trivial assignments, constants, or type guarantees with no business risk.
- The same behavior repeatedly through equivalent scenarios.

## Test Quality

Each test should protect one clear behavior and make the reason for the expectation easy to understand.

Avoid duplicate tests. Before adding one, check whether an existing test already protects the same rule, acceptance criterion, edge case, or regression risk. Extend an existing test only when the new scenario adds distinct value.

Avoid fragile tests. Tests should not depend unnecessarily on:

- Internal function calls or call order.
- Object property order when order is not part of the behavior.
- Exact markup structure when user-visible behavior is the requirement.
- Incidental copy, formatting, generated identifiers, or timestamps.
- Large snapshots that hide the behavior being protected.

Mocks and snapshots should be used only when they make an important behavior clearer and more stable. Do not use them as a substitute for asserting the relevant outcome.

## Unit Tests

Use unit tests for:

- Quote subtotal calculations.
- Quote total calculations.
- Domain helpers.
- Data transformation functions.
- Validation helpers.

Unit tests should be fast and deterministic.

## Examples

Good tests protect a documented behavior or risk:

```text
calculates a quote line subtotal from quantity and unit price
returns a zero total when the quote has no lines
does not change the catalog price when a quote line price is edited
```

Bad tests add volume without protecting useful behavior or depend on implementation details:

```text
calls reduce once for every quote line
stores the intermediate subtotal in a local variable
renders the exact current DOM tree as a large snapshot
repeats the same total calculation with different arbitrary values
```

A different input is worth a separate test when it represents a distinct business rule, boundary, failure mode, or regression risk. Changing values without changing the behavior under test does not justify another test.

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
