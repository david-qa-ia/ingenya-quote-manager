# AI Agent Workflow

This document defines how AI agents should work in Ingenya Quote Manager.

## Goal

AI agents should help implement tickets while respecting product rules, architecture rules, coding standards, and quality gates.

The goal is controlled AI-assisted development, not uncontrolled code generation.

## Standard Flow

Every meaningful change should follow this flow:

```text
Jira ticket -> feature branch -> implementation -> local checks -> pull request -> CI -> review -> merge
```

## Step 1: Read Context

Before editing code, the agent must read:

- The Jira ticket.
- `AGENTS.md`
- `docs/architecture/product-rules.md`
- `docs/architecture/coding-rules.md`
- `docs/architecture/ui-rules.md`
- `docs/architecture/testing-rules.md`
- This workflow document.

## Step 2: Confirm Scope

The agent must identify:

- What the ticket asks for.
- What is explicitly out of scope.
- What files are likely to change.
- What checks must pass.

If the scope is unclear, the agent must ask before implementing.

## Step 3: Work On A Feature Branch

Agents must not work directly on `main`.

Branch names should include the Jira issue key.

Example:

```text
feat/SCRUM-16-ai-agent-workflow
```

## Step 4: Implement Small Changes

Agents should prefer small, focused changes.

Do not mix unrelated work such as:

- UI implementation and pipeline changes.
- Product rule changes and visual redesign.
- Refactors and new features.
- Test setup and unrelated component rewrites.

## Step 5: Validate Locally

Before opening a pull request, run:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

If formatting fails, run:

```bash
npm run format
```

Then run the validation commands again.

## Step 6: Open Pull Request

The pull request should include:

- Jira ticket key.
- Summary of changes.
- Scope.
- Validation performed.
- Screenshots or videos when UI changes are included.

## Step 7: CI Must Pass

GitHub Actions must pass before merging.

If CI fails, fix the issue in the branch and rerun the checks.

Do not bypass CI.

## Step 8: Merge And Close Ticket

After merge:

- Delete the feature branch.
- Update the Jira ticket with evidence.
- Move the ticket to `Done`.

## Agent Stop Conditions

Agents should stop and ask for direction when:

- The requested change conflicts with product rules.
- The ticket requires a decision not documented anywhere.
- A dependency is needed but not justified.
- A command fails and the cause is unclear.
- The implementation would require expanding the ticket scope.
