-- SCRUM-117: team responsibles per workspace and the chosen next step of a contact result.
--
-- 1. Several people share one account, so every result records who did it. The list of names is
--    managed in Configuración and must be the same on every device, hence it lives here.
--    Removing someone only deactivates the row: history keeps their name.
-- 2. register_prospect_result stored "Retomar contacto" whatever next step was chosen. It now
--    receives p_next_action ("Enviar presupuesto", "Llamar", ...) and keeps it in the prospect
--    and in the activity.

create table if not exists public.workspace_responsibles (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 80),
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_responsibles_active_name_idx
  on public.workspace_responsibles (workspace_id, lower(btrim(name)))
  where active;

create unique index if not exists workspace_responsibles_primary_idx
  on public.workspace_responsibles (workspace_id)
  where is_primary and active;

-- One version per workspace list, so two devices editing at once get a conflict instead of
-- silently overwriting each other (persistence-architecture.md: expected_version).
create table if not exists public.workspace_responsible_lists (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workspace_responsibles enable row level security;
alter table public.workspace_responsible_lists enable row level security;

drop policy if exists workspace_responsibles_workspace_isolation on public.workspace_responsibles;
create policy workspace_responsibles_workspace_isolation
  on public.workspace_responsibles for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists workspace_responsible_lists_workspace_isolation on public.workspace_responsible_lists;
create policy workspace_responsible_lists_workspace_isolation
  on public.workspace_responsible_lists for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

grant select on public.workspace_responsibles, public.workspace_responsible_lists to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.workspace_responsibles, public.workspace_responsible_lists
  from anon, authenticated;

-- Replaces the active list in one transaction. p_responsibles is an array of
-- {"id": uuid, "name": text, "isPrimary": boolean}; rows left out are deactivated, never
-- deleted, so history keeps their names. p_expected_version is null for the first save.
create or replace function public.save_workspace_responsibles(
  p_workspace_id uuid,
  p_expected_version bigint,
  p_responsibles jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  primary_count int;
  active_ids uuid[] := '{}';
  current_version bigint;
  before_state jsonb;
  after_state jsonb;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'save_workspace_responsibles' and key = p_idempotency_key;
  if response is not null then return response; end if;

  if jsonb_typeof(p_responsibles) is distinct from 'array' or jsonb_array_length(p_responsibles) = 0 then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Agregá al menos un responsable.');
  end if;
  select count(*) into primary_count
  from jsonb_array_elements(p_responsibles) as entry
  where coalesce((entry->>'isPrimary')::boolean, false);
  if primary_count <> 1 then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Elegí un responsable principal.');
  end if;
  for item in select * from jsonb_array_elements(p_responsibles) loop
    if length(btrim(coalesce(item->>'name', ''))) not between 1 and 80 then
      return jsonb_build_object('code', 'VALIDATION', 'message', 'Revisá los nombres de los responsables.');
    end if;
    if exists (
      select 1 from public.workspace_responsibles existing
      where existing.id = (item->>'id')::uuid and existing.workspace_id <> p_workspace_id
    ) then
      raise exception using errcode = '42501', message = 'workspace-access-denied';
    end if;
    active_ids := active_ids || (item->>'id')::uuid;
  end loop;

  insert into public.workspace_responsible_lists (workspace_id, version)
    values (p_workspace_id, 0)
    on conflict (workspace_id) do nothing;
  select version into current_version from public.workspace_responsible_lists
    where workspace_id = p_workspace_id for update;
  if coalesce(p_expected_version, 0) <> current_version then
    return jsonb_build_object('code', 'CONFLICT', 'version', current_version);
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) into before_state
    from public.workspace_responsibles r where r.workspace_id = p_workspace_id;

  -- Clear the primary flag first so the partial unique index never sees two primaries.
  update public.workspace_responsibles
    set is_primary = false, updated_at = now()
    where workspace_id = p_workspace_id and is_primary;
  update public.workspace_responsibles
    set active = false, updated_at = now()
    where workspace_id = p_workspace_id and active and not (id = any(active_ids));

  for item in select * from jsonb_array_elements(p_responsibles) loop
    insert into public.workspace_responsibles (id, workspace_id, name, is_primary, active)
    values (
      (item->>'id')::uuid,
      p_workspace_id,
      btrim(item->>'name'),
      coalesce((item->>'isPrimary')::boolean, false),
      true
    )
    on conflict (id) do update
      set name = excluded.name,
          is_primary = excluded.is_primary,
          active = true,
          updated_at = now();
  end loop;

  update public.workspace_responsible_lists
    set version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id
    returning version into current_version;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) into after_state
    from public.workspace_responsibles r where r.workspace_id = p_workspace_id;

  response := jsonb_build_object('code', 'OK', 'version', current_version, 'idempotent', false);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), 'update', 'workspace_responsibles', p_workspace_id,
      p_request_id, p_idempotency_key, before_state, after_state, 'success');
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'save_workspace_responsibles', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
exception
  when unique_violation then
    return jsonb_build_object('code', 'DUPLICATE', 'message', 'Hay dos responsables con el mismo nombre.');
end;
$$;

revoke all on function public.save_workspace_responsibles(uuid, bigint, jsonb, text, text) from public;
grant execute on function public.save_workspace_responsibles(uuid, bigint, jsonb, text, text) to authenticated;

-- Same function as 202610280005 plus p_next_action. The old signature is dropped so PostgREST
-- has a single candidate to call.
drop function if exists public.register_prospect_result(uuid, uuid, bigint, text, text, text, timestamptz, text, text, text);

create or replace function public.register_prospect_result(
  p_workspace_id uuid,
  p_prospect_id uuid,
  p_expected_version bigint,
  p_result text,
  p_channel text,
  p_note text,
  p_follow_up_at timestamptz,
  p_responsible text,
  p_idempotency_key text,
  p_request_id text default null,
  p_next_action text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prospect public.prospects%rowtype;
  response jsonb;
  next_status text;
  next_action_label text;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'register_prospect_result' and key = p_idempotency_key;
  if response is not null then return response; end if;

  select * into current_prospect from public.prospects
  where workspace_id = p_workspace_id and id = p_prospect_id and archived_at is null
  for update;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
  if current_prospect.version <> p_expected_version then
    return jsonb_build_object('code', 'CONFLICT', 'version', current_prospect.version);
  end if;

  next_status := case
    when p_result = 'reschedule' then current_prospect.status
    when p_result = 'noResponse' then 'noResponse'
    when p_result = 'discarded' then 'notInterested'
    when p_result = 'interested' then 'interested'
    else 'contacted'
  end;
  next_action_label := case
    when p_follow_up_at is null then ''
    else coalesce(nullif(btrim(p_next_action), ''), 'Retomar contacto')
  end;

  update public.prospects
  set status = next_status,
      next_action = next_action_label,
      next_action_at = p_follow_up_at,
      responsible = coalesce(p_responsible, ''),
      preferred_channel = nullif(p_channel, ''),
      version = version + 1,
      updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id;

  insert into public.activities (
    id, workspace_id, prospect_id, type, occurred_at, author_id, result, note, source, communication
  ) values (
    gen_random_uuid(), p_workspace_id, p_prospect_id, 'contactResult', now(), auth.uid(),
    coalesce(p_result, ''), coalesce(p_note, ''), 'manual',
    jsonb_strip_nulls(jsonb_build_object(
      'channel', p_channel,
      'followUpAt', p_follow_up_at,
      'nextAction', nullif(next_action_label, ''),
      'previousFollowUpAt', case
        when current_prospect.next_action_at is not null
          and current_prospect.next_action_at is distinct from p_follow_up_at
        then current_prospect.next_action_at
      end,
      'responsible', p_responsible
    ))
  );

  select jsonb_build_object('code', 'OK', 'version', version, 'idempotent', false)
    into response from public.prospects where workspace_id = p_workspace_id and id = p_prospect_id;
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'register_prospect_result', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.register_prospect_result(uuid, uuid, bigint, text, text, text, timestamptz, text, text, text, text) from public;
grant execute on function public.register_prospect_result(uuid, uuid, bigint, text, text, text, timestamptz, text, text, text, text) to authenticated;
