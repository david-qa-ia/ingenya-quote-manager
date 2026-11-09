# Agent Guide

Ventro (repository `ingenya-quote-manager`) is the commercial app Daniel uses to sell construction
services: prospects, clients, opportunities, quotes, follow-up and metrics. This file is the only
required reading. The documents under `docs/architecture/` are references: open one only when the
change touches its topic (table below).

## Product Boundaries

- "Labor" means a service charged to the final client (paint a wall, install a door), never
  workers, wages, unions, UOCRA or salary tables.
- In scope: quotes for services (drafts, finalization, versions, PDF), clients, opportunities,
  prospecting (manual, CSV, first contact, conversion, archive), follow-up and cadences, registered
  sends, commercial outcomes, metrics ("Indicadores") and workspaces.
- Supabase is the source of truth when configured (Auth, RLS, transactional RPCs, migrations in
  `supabase/migrations`). localStorage keeps a mirror namespaced by workspace. Without Supabase
  variables the app runs local-only.
- The app records what the user confirms. It never sends WhatsApp or email by itself; it may open a
  chat, dialer or mail draft for the user to send.
- Out of scope unless the owner asks: materials, taxes, margins, voice input, automatic sending and
  per-user permissions for the reserved `collaborator` role.

## Code Rules

- Code, identifiers, file names, commits and PR titles in English. Every user-facing text in
  Spanish, without internal codes.
- Business logic lives in pure functions in `src/utils`, types in `src/types`; React components
  present and interact. Prefer derived values over duplicated state.
- Forms: validation in pure `get*FieldErrors` functions, one message per field with `FieldError`
  and `useFieldValidation`; save errors in `.form-error` with `role="alert"`. Existing
  `get*ValidationError` functions also guard stored data and CSV import: change them only with
  equivalence tests.
- UI: follow `docs/architecture/ui-rules.md` (Ventro blue `#2F6BFF`, shared tokens in
  `src/index.css` and `src/App.css`, icons only through `UiIcon`). Check the desktop and the narrow
  layout of every screen you change.
- Storage: validate what you read, never overwrite stored data silently, and do not add storage
  keys, tables or RPCs without reading the storage docs below.
- No new dependency without a short reason in the PR (problem, why now, why the platform is not
  enough). No form, validation or UI-kit libraries.

## Tests

- Every test protects a business rule, an acceptance criterion, an edge case or a regression.
  Assert observable results through public functions; no snapshots of large trees, no tests of
  call order or private helpers, no near-duplicate scenarios.
- A bug fix ships with a test that fails without the fix.
- Never delete, skip or loosen a test to make CI pass.

## Workflow

1. Branch from an up-to-date `main`: `fix/…`, `feat/…`, `refactor/…` or `docs/…`, plus the Jira key
   when a ticket exists (tickets are optional).
2. Keep one concern per branch. Large features ship as a sequence of small PRs, each one green and
   usable on its own.
3. Run `npm run format`, then the same checks as CI:
   `npm run format:check && npm run lint && npm test && npm run build`.
4. Open the PR with `.github/pull_request_template.md`. For UI changes, describe what was checked in
   the browser.
5. `main` requires the "Quality checks" status on an up-to-date branch: update the branch, wait for
   CI, then squash-merge. Merge only when the owner has delegated merging; otherwise leave the PR
   open.

Stop and ask only when a change conflicts with these rules, needs a product decision nobody has
made, or cannot be undone. Otherwise decide, and record the decision in the PR.

## Working Efficiently

- `src/App.tsx` (about 3,500 lines) and `src/components/ProspectingView.tsx` (about 2,500) are too
  large to read whole: search for the symbol and read the surrounding lines.
- Run the focused test file while working (`npx vitest run path/to/file.test.ts`) and the full
  suite once before the PR.
- Prefer extending an existing helper or component over a parallel one; search `src/utils` first.

## Reference Docs (open only when relevant)

| Topic                                                     | Document                                        |
| --------------------------------------------------------- | ----------------------------------------------- |
| Units, catalog, quote lines, snapshots, commercial status | `docs/architecture/product-rules.md`            |
| Visual language, components, icons                        | `docs/architecture/ui-rules.md`                 |
| Test examples                                             | `docs/architecture/testing-rules.md`            |
| localStorage keys, recovery, local mirror                 | `docs/architecture/storage-architecture.md`     |
| Supabase model, RPCs, idempotency, audit                  | `docs/architecture/persistence-architecture.md` |
| Workspaces, sign-in, active workspace                     | `docs/architecture/workspaces.md`               |
| Quote document and commercial statuses                    | `docs/architecture/quote-status.md`             |
| Deployment (Cloudflare Pages)                             | `docs/architecture/deployment.md`               |
| Notes from past tickets                                   | `docs/architecture/history/`                    |
