-- SCRUM-125: one workspace per company, shared only with the people its owner adds.
--
-- * admin_create_workspace: Ventro creates a company's workspace from the SQL Editor and sets
--   its owner (a user already created in Authentication). Not callable from the app.
-- * list/add/remove_workspace_member: the owner manages who else can open the workspace (for
--   example, Martita adds David). Members are added as 'admin'; owners cannot be removed here.
-- Data stays separated because every table is filtered by workspace_id and membership (RLS and
-- the RPCs); adding a member only grants access to that one workspace.

create or replace function public.admin_create_workspace(p_name text, p_owner_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_workspace uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_suffix int := 1;
begin
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Escribí el nombre de la empresa (1 a 80 caracteres).';
  end if;
  select id into v_owner from auth.users where lower(email) = lower(btrim(p_owner_email));
  if v_owner is null then
    raise exception 'No existe el usuario %. Crealo primero en Authentication > Users.', p_owner_email;
  end if;
  v_base := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'espacio'; end if;
  v_slug := v_base;
  while exists (select 1 from public.workspaces where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;
  insert into public.workspaces (id, name, slug) values (v_workspace, btrim(p_name), v_slug);
  insert into public.workspace_memberships (workspace_id, user_id, role)
    values (v_workspace, v_owner, 'owner');
  return v_workspace;
end;
$$;

-- Only the database owner (SQL Editor / service role) may create workspaces.
revoke all on function public.admin_create_workspace(text, text) from public, anon, authenticated;

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_commercial_rpc_access(p_workspace_id, true);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', m.user_id,
      'email', u.email,
      'role', m.role,
      'isYou', m.user_id = auth.uid()
    ) order by (m.role = 'owner') desc, lower(u.email))
    from public.workspace_memberships m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and m.status = 'active'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_workspace_members(uuid) from public;
grant execute on function public.list_workspace_members(uuid) to authenticated;

create or replace function public.add_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  response jsonb;
  v_user uuid;
  before_row public.workspace_memberships%rowtype;
  saved_row public.workspace_memberships%rowtype;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id, true);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'add_workspace_member' and key = p_idempotency_key;
  if response is not null then return response; end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user is null then
    return jsonb_build_object('code', 'NOT_FOUND',
      'message', 'No hay ningún usuario con ese email. Pedile a Ventro que lo cree.');
  end if;
  select * into before_row from public.workspace_memberships
    where workspace_id = p_workspace_id and user_id = v_user for update;
  if found and before_row.status = 'active' then
    return jsonb_build_object('code', 'ALREADY_MEMBER', 'message', 'Esa persona ya tiene acceso.');
  end if;

  insert into public.workspace_memberships as m (workspace_id, user_id, role, status)
    values (p_workspace_id, v_user, 'admin', 'active')
    on conflict (workspace_id, user_id) do update
      set status = 'active', role = case when m.role = 'owner' then 'owner' else 'admin' end,
          updated_at = now()
    returning * into saved_row;

  response := jsonb_build_object('code', 'OK', 'userId', v_user);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), 'create', 'workspace_membership', v_user, p_request_id,
      p_idempotency_key, case when before_row.user_id is null then null else to_jsonb(before_row) end,
      to_jsonb(saved_row), 'success');
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'add_workspace_member', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.add_workspace_member(uuid, text, text, text) from public;
grant execute on function public.add_workspace_member(uuid, text, text, text) to authenticated;

create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  response jsonb;
  before_row public.workspace_memberships%rowtype;
  saved_row public.workspace_memberships%rowtype;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id, true);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'remove_workspace_member' and key = p_idempotency_key;
  if response is not null then return response; end if;

  select * into before_row from public.workspace_memberships
    where workspace_id = p_workspace_id and user_id = p_user_id and status = 'active' for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND', 'message', 'Esa persona ya no tiene acceso.');
  end if;
  if before_row.role = 'owner' then
    return jsonb_build_object('code', 'FORBIDDEN', 'message', 'No se puede quitar al propietario del espacio.');
  end if;

  update public.workspace_memberships set status = 'inactive', updated_at = now()
    where workspace_id = p_workspace_id and user_id = p_user_id
    returning * into saved_row;

  response := jsonb_build_object('code', 'OK');
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), 'update', 'workspace_membership', p_user_id, p_request_id,
      p_idempotency_key, to_jsonb(before_row), to_jsonb(saved_row), 'success');
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'remove_workspace_member', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.remove_workspace_member(uuid, uuid, text, text) from public;
grant execute on function public.remove_workspace_member(uuid, uuid, text, text) to authenticated;
