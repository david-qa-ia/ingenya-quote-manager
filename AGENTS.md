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

If the ticket touches persistence, drafts, saved quotes, localStorage, quote recovery, or stored data, agents must also read:

- `docs/architecture/storage-architecture.md`
- `docs/architecture/persistence-architecture.md`

If the ticket touches workspaces, sign-in or the active workspace, agents must also read:

- `docs/architecture/workspaces.md`

## Product Boundaries

- The app (Brio / Ingenya Quote Manager) helps Daniel manage commercial work for construction
  services: prospects, clients, opportunities, quotes and their follow-up.
- "Labor" means services charged to the final client, not workers, wages, salaries, unions, UOCRA, or construction chamber labor tables.
- Current scope (updated 2026-10-29, SCRUM-108):
  - Quotes for services/labor: drafts, finalization, versions and PDF.
  - Clients (contacts) and opportunities, with qualification and next actions.
  - Prospecting: manual and CSV import, first contact, contact results, conversion to an
    opportunity, and archive/restore (SCRUM-111).
  - Follow-up ("Seguimiento"), cadences, registered quote sends and commercial outcomes
    (accepted, rejected, lost, reopened).
  - Commercial metrics ("Indicadores").
  - Workspaces with Supabase as the source of truth (Auth, RLS, transactional RPCs and
    migrations in `supabase/migrations`), plus a workspace-namespaced local mirror in
    localStorage. Without Supabase environment variables the app runs in local-only mode.
- The app records contacts and sends that the user confirms; it never sends WhatsApp or email
  messages by itself.
- Materials, taxes, margins, AI voice input, automatic message sending and team permissions for
  the reserved `collaborator` role are outside the current scope unless a Jira ticket explicitly
  includes them.

## Forms And Validation

- Validation rules live in pure functions in `src/utils` (for example `getProspectFieldErrors`,
  `getClientFieldErrors`). Existing `get*ValidationError` functions also guard stored data and
  CSV import, so change them only with equivalence tests.
- Forms show one message per field with the shared `FieldError` component and
  `useFieldValidation` hook: `aria-invalid`, `aria-describedby`, focus on the first invalid field,
  and the `var(--danger)` color. Save or server errors use `.form-error` with `role="alert"`, in
  Spanish and without internal codes.
- Do not add form or validation libraries (react-hook-form, yup, zod, UI kits) without a
  justification approved in the Jira ticket.

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
