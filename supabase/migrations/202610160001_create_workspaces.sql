create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'collaborator')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

create or replace function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships membership
    join public.workspaces workspace on workspace.id = membership.workspace_id
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and workspace.status = 'active'
  );
$$;

create policy "members can read active workspaces"
  on public.workspaces for select
  using (public.is_active_workspace_member(id));

create policy "members can read their memberships"
  on public.workspace_memberships for select
  using (user_id = auth.uid() and status = 'active' and public.is_active_workspace_member(workspace_id));

-- Commercial tables created by SCRUM-79 must include workspace_id not null and use:
-- public.is_active_workspace_member(workspace_id) in every read/write policy.
