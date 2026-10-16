-- SCRUM-78: relational contract for SCRUM-79.
-- This migration defines ownership, versions, idempotency, audit and recovery primitives.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  company text not null default '',
  phone text not null default '',
  email text not null default '',
  source text not null default '',
  potential_service text not null default '',
  notes text not null default '',
  status text not null,
  priority text not null,
  priority_reason text not null default '',
  next_action text not null default '',
  next_action_at timestamptz,
  responsible text not null default '',
  preferred_channel text,
  conversion jsonb,
  version bigint not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  company text,
  phone text not null default '',
  email text not null default '',
  preferred_channel text,
  contact_consent boolean not null default false,
  do_not_contact jsonb,
  version bigint not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  contact_id uuid not null,
  name text not null,
  address text not null default '',
  estimated_start_date date,
  responsible_seller text not null default '',
  origin text,
  tag text,
  closing_probability numeric,
  estimated_close_date date,
  status text not null default 'active',
  commercial_state text not null default 'open',
  pipeline_stage text not null default 'prospect',
  version bigint not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, contact_id) references public.contacts(workspace_id, id)
);

create table if not exists public.next_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  opportunity_id uuid not null,
  kind text,
  type text not null,
  description text not null,
  due_at timestamptz not null,
  responsible text not null,
  priority text not null,
  status text not null default 'pending',
  cadence_origin jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  prospect_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  quote_id uuid,
  type text not null,
  occurred_at timestamptz not null,
  author_id uuid not null references auth.users(id),
  result text not null default '',
  note text not null default '',
  source text not null,
  event text,
  communication jsonb,
  note_revisions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.commercial_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  opportunity_id uuid not null,
  quote_id uuid,
  type text not null,
  reason_code text,
  note text,
  author_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  supersedes_outcome_id uuid,
  unique (workspace_id, id),
  foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  opportunity_id uuid,
  contact_id uuid,
  current_version integer not null default 1,
  commercial_status text not null default 'prepared',
  version bigint not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id),
  foreign key (workspace_id, contact_id) references public.contacts(workspace_id, id)
);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  quote_id uuid not null,
  version_number integer not null,
  based_on_version_id uuid,
  status text not null default 'draft',
  client_name text not null default '',
  project_name text not null default '',
  lines jsonb not null default '[]'::jsonb,
  change_request jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, quote_id, version_number),
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id)
);

create table if not exists public.quote_sends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  quote_version_id uuid not null,
  channel text not null,
  recipient text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid not null references auth.users(id),
  idempotency_key text not null,
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, quote_version_id) references public.quote_versions(workspace_id, id)
);

create table if not exists public.quote_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  quote_version_id uuid not null,
  reason text not null,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, quote_version_id) references public.quote_versions(workspace_id, id)
);

create table if not exists public.cadence_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  description text not null default '',
  status text not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.cadence_template_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  template_id uuid not null,
  step_order integer not null,
  channel text not null,
  description text not null,
  wait_amount integer not null,
  wait_unit text not null,
  responsible text not null,
  status text not null default 'active',
  unique (workspace_id, id),
  unique (workspace_id, template_id, step_order),
  foreign key (workspace_id, template_id) references public.cadence_templates(workspace_id, id)
);

create table if not exists public.cadence_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  template_id uuid not null,
  opportunity_id uuid,
  quote_id uuid,
  status text not null default 'active',
  current_step_execution_id uuid,
  template_snapshot jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, template_id) references public.cadence_templates(workspace_id, id),
  foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id),
  foreign key (workspace_id, quote_id) references public.quotes(workspace_id, id),
  check ((opportunity_id is not null) <> (quote_id is not null))
);

create table if not exists public.cadence_step_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  execution_id uuid not null,
  template_step_id uuid not null,
  step_order integer not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  result text,
  version bigint not null default 1,
  unique (workspace_id, id),
  foreign key (workspace_id, execution_id) references public.cadence_executions(workspace_id, id),
  foreign key (workspace_id, template_step_id) references public.cadence_template_steps(workspace_id, id)
);

create table if not exists public.cadence_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  execution_id uuid not null,
  step_execution_id uuid,
  type text not null,
  actor_id uuid not null references auth.users(id),
  reason text not null default '',
  occurred_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, execution_id) references public.cadence_executions(workspace_id, id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  owner_id uuid not null references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, storage_path)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  operation text not null,
  entity_type text not null,
  entity_id uuid,
  request_id text,
  idempotency_key text,
  before_state jsonb,
  after_state jsonb,
  result text not null,
  error_code text,
  occurred_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  operation text not null,
  key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, actor_id, operation, key)
);

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create table if not exists public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  destination_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  snapshot_fingerprint text not null,
  snapshot_checksum text not null,
  status text not null default 'dry_run',
  source_counts jsonb not null default '{}'::jsonb,
  imported_counts jsonb not null default '{}'::jsonb,
  quarantined_counts jsonb not null default '{}'::jsonb,
  checkpoint jsonb not null default '{}'::jsonb,
  started_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_workspace_id, destination_workspace_id, snapshot_fingerprint)
);

create table if not exists public.migration_items (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  destination_type text,
  destination_id uuid,
  status text not null default 'pending',
  error_code text,
  error_detail text,
  processed_at timestamptz,
  unique (migration_run_id, source_type, source_id)
);

create table if not exists public.migration_quarantine (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  raw_record jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (migration_run_id, source_type, source_id)
);

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    join public.workspaces workspace on workspace.id = membership.workspace_id
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and workspace.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

-- Every commercial table is isolated by the same server-side membership check.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'prospects', 'contacts', 'opportunities', 'next_actions', 'activities',
    'commercial_outcomes', 'quotes', 'quote_versions', 'quote_sends',
    'quote_change_requests', 'cadence_templates', 'cadence_template_steps',
    'cadence_executions', 'cadence_step_executions', 'cadence_events',
    'attachments', 'audit_events', 'idempotency_keys', 'outbox_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all using (public.is_active_workspace_member(workspace_id)) with check (public.is_active_workspace_member(workspace_id))',
      table_name || '_workspace_isolation', table_name
    );
  end loop;
end $$;

alter table public.migration_runs enable row level security;
alter table public.migration_items enable row level security;
alter table public.migration_quarantine enable row level security;

create policy "migration owners can operate runs"
  on public.migration_runs for all
  using (public.has_workspace_role(destination_workspace_id, array['owner']))
  with check (public.has_workspace_role(destination_workspace_id, array['owner']));

create policy "migration owners can read items"
  on public.migration_items for select
  using (exists (select 1 from public.migration_runs run where run.id = migration_run_id and public.has_workspace_role(run.destination_workspace_id, array['owner'])));

create policy "migration owners can read quarantine"
  on public.migration_quarantine for select
  using (exists (select 1 from public.migration_runs run where run.id = migration_run_id and public.has_workspace_role(run.destination_workspace_id, array['owner'])));

comment on table public.migration_runs is 'One source workspace, destination workspace and snapshot fingerprint per run; resume existing IDs only.';
comment on table public.outbox_events is 'Only for post-commit external work; transactional failures roll back and never use requiere_recuperacion.';
