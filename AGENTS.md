# Agent Instructions

This repository is the Ingenya Quote Manager project.

AI agents are allowed to help with implementation, refactoring, tests, documentation, and quality checks, but they must follow the project rules before changing code.

## Required Reading Before Changes

Before editing files, agents must read:

- `AGENTS.md`
- `docs/architecture/product-rules.md`
- `docs/architecture/coding-rules.md`
- `docs/architecture/ui-rules.md`
- `docs/architecture/testing-rules.md`
- `docs/architecture/ai-agent-workflow.md`

## Product Boundaries

- The app helps Daniel create construction service quotes.
- "Labor" means services charged to the final client, not workers, wages, salaries, unions, UOCRA, or construction chamber labor tables.
- The current scope is quote creation for services/labor only.
- Materials, taxes, margins, PDF generation, persistence, AI voice input, and customer follow-up are outside the current implementation scope unless a Jira ticket explicitly includes them.

## Code Language Rules

- Code, variables, functions, types, file names, and commit messages must be written in English.
- UI text shown to the user must be written in Spanish.
- Keep domain concepts explicit and simple.

## Workflow Rules

- Every meaningful change must be linked to a Jira ticket.
- Work must happen on a feature branch, not directly on `main`.
- Branch names should include the Jira ticket key when possible.
- Pull requests must describe the change, ticket, scope, and validation performed.
- Do not mix unrelated tickets in the same branch.

## Quality Rules

Before opening or merging a pull request, agents must run:

```bash
npm run format:check
npm run lint
npm test
npm run build
```
