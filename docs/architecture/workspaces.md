# Workspaces and memberships (SCRUM-80)

Ingenya uses one authenticated identity with memberships in multiple workspaces. The active
workspace is a UI context, never an authorization boundary: the server validates the authenticated
user's active membership on every operation.

Workspace names come from the `workspaces` table. In the current Supabase environment they are
Brio, Alef-Tau and Negocio familiar (Brio is the commercial brand shown on the sign-in screen).
The local development adapter, used without Supabase variables, still names the first workspace
Ingenya; the name is cosmetic and its ID is `workspace-ingenya`. _(Updated 2026-10-29, SCRUM-108;
the original text listed "Ingenya, Alef-Tau and Negocio familiar".)_ Roles are `owner` and `admin`;
`collaborator` is reserved as a future model and does not add team permissions in this increment.

All commercial records and files created by SCRUM-79 must have a mandatory `workspace_id`. RLS
policies must call `is_active_workspace_member(workspace_id)` for reads and writes. A workspace ID
sent by the browser is never trusted on its own.

The current frontend includes a development workspace adapter so the selector and recovery states
can be validated before the backend environment is configured. When `VITE_WORKSPACE_API_URL` is
present, the adapter uses authenticated `/api/workspaces` and `/api/workspaces/active` requests;
the server remains authoritative.

The persistence contract, transactional RPCs, migration fingerprints and recovery rules are defined
in [`persistence-architecture.md`](./persistence-architecture.md). SCRUM-79 must implement that
contract before replacing these local adapters as the source of truth.

Changing workspaces invalidates all local collection keys through the workspace namespace. Forms,
filters, search results, metrics and detail context are reset only after the server confirms the
new active workspace. A failed switch keeps the previous workspace and form unchanged.
