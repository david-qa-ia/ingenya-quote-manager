# Workspaces and memberships (SCRUM-80)

Ventro uses one authenticated identity with memberships in multiple workspaces. The active
workspace is a UI context, never an authorization boundary: the server validates the authenticated
user's active membership on every operation.

Workspace names come from the `workspaces` table. In the current Supabase environment they are
Brio, Alef-Tau and Negocio familiar. Since SCRUM-116 the app's brand is Ventro; the "Brio" row in
the `workspaces` table is data and must be renamed in Supabase separately. The local development
adapter, used without Supabase variables, names the first workspace Ventro; the name is cosmetic
and its ID stays `workspace-ingenya` (and the slug `ingenya`) so existing local data keeps working. _(Updated 2026-10-29, SCRUM-108;
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

## One workspace per company (SCRUM-125)

Each company that gets the app has its own workspace. Its data never mixes with other
workspaces: every table and RPC checks `workspace_id` against the user's active memberships.

**New company (Ventro, in the Supabase dashboard):**

1. Authentication > Users > Add user: the person's email and password.
2. SQL Editor:
   ```sql
   select public.admin_create_workspace('Martita', 'martita@pasteleria.com');
   ```
   It creates the workspace (unique slug) with that user as `owner`. The function cannot be called
   from the app: only the SQL Editor or the service role can run it.

**Sharing a workspace:** the owner opens Configuración > Miembros del espacio, writes the email of
someone who already has a user, and selects "Dar acceso". That person joins as `admin` of that
workspace only and sees it in the workspace selector the next time they sign in. "Quitar acceso"
deactivates the membership (history keeps it); owners cannot be removed from the app.

RPCs: `list_workspace_members`, `add_workspace_member` and `remove_workspace_member` (owner only,
idempotent, audited). Migration: `202611040005_workspace_members.sql`.

## Password recovery (SCRUM-126)

"¿Olvidaste tu contraseña?" on the sign-in card calls Supabase `/auth/v1/recover` with
`redirect_to` = the app's own address. The emailed link opens the app with the recovery tokens in
the URL fragment; `src/main.tsx` reads them once, removes them from the address bar and shows
"Elegí una contraseña nueva" (`PUT /auth/v1/user`). Saving signs the person in. An expired or used
link shows a message on the sign-in card. The screen never says whether an email has a user
(every answer but a server error reads "sent", rate limits included). The new password follows
the Supabase rule: 8+ characters with a lowercase, an uppercase, a digit and a symbol, shown as a
checklist while typing.

Supabase settings (Authentication > URL Configuration): Site URL = the published address (for
example `https://gestion.somosventro.com`) and Redirect URLs including `https://gestion.somosventro.com/**`
(plus `http://localhost:5173/**` for development). Supabase's built-in mailer sends only a few
emails per hour; configure custom SMTP before many companies use it.
