-- SCRUM-91: keep the work address from prospecting through the commercial context.
alter table public.prospects add column if not exists address text not null default '';

create or replace function public.create_prospect(
  p_workspace_id uuid,
  p_prospect_id uuid,
  p_payload jsonb,
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
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'create_prospect' and key = p_idempotency_key;
  if response is not null then return response; end if;

  insert into public.prospects (
    id, workspace_id, name, company, phone, email, instagram, address, source, potential_service,
    notes, status, priority, priority_reason, next_action, next_action_at,
    responsible, preferred_channel
  ) values (
    p_prospect_id, p_workspace_id,
    coalesce(p_payload->>'name', ''), coalesce(p_payload->>'company', ''),
    coalesce(p_payload->>'phone', ''), coalesce(p_payload->>'email', ''),
    coalesce(p_payload->>'instagram', ''), coalesce(p_payload->>'address', ''), coalesce(p_payload->>'source', ''),
    coalesce(p_payload->>'potentialService', ''), coalesce(p_payload->>'notes', ''),
    coalesce(p_payload->>'status', 'uncontacted'), coalesce(p_payload->>'priority', 'medium'),
    coalesce(p_payload->>'priorityReason', ''), coalesce(p_payload->>'nextAction', ''),
    nullif(p_payload->>'nextActionAt', '')::timestamptz,
    coalesce(p_payload->>'responsible', ''), nullif(p_payload->>'preferredChannel', '')
  ) on conflict (workspace_id, id) do nothing;

  response := jsonb_build_object('code', 'OK', 'entity', 'prospect', 'entityId', p_prospect_id, 'version', 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'create_prospect', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result)
  values (p_workspace_id, auth.uid(), 'create', 'prospect', p_prospect_id, p_request_id, p_idempotency_key, p_payload, 'success');
  return response;
end;
$$;

create or replace function public.update_prospect_profile(
  p_workspace_id uuid,
  p_prospect_id uuid,
  p_expected_version bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_prospect public.prospects%rowtype;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'update_prospect_profile' and key = p_idempotency_key;
  if response is not null then return response; end if;
  select * into current_prospect from public.prospects
  where workspace_id = p_workspace_id and id = p_prospect_id and archived_at is null
  for update;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
  if current_prospect.version <> p_expected_version then
    return jsonb_build_object('code', 'CONFLICT', 'version', current_prospect.version);
  end if;

  update public.prospects set
    name = coalesce(p_payload->>'name', current_prospect.name),
    company = coalesce(p_payload->>'company', ''), phone = coalesce(p_payload->>'phone', ''),
    email = coalesce(p_payload->>'email', ''), instagram = coalesce(p_payload->>'instagram', ''),
    address = coalesce(p_payload->>'address', ''), source = coalesce(p_payload->>'source', ''),
    potential_service = coalesce(p_payload->>'potentialService', ''), notes = coalesce(p_payload->>'notes', ''),
    priority = coalesce(p_payload->>'priority', current_prospect.priority),
    priority_reason = coalesce(p_payload->>'priorityReason', ''),
    responsible = coalesce(p_payload->>'responsible', ''),
    preferred_channel = nullif(p_payload->>'preferredChannel', ''),
    version = version + 1, updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id;

  select jsonb_build_object('code', 'OK', 'version', version, 'idempotent', false)
  into response from public.prospects where workspace_id = p_workspace_id and id = p_prospect_id;
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'update_prospect_profile', p_idempotency_key,
    coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

create or replace function public.convert_prospect_to_opportunity(
  p_workspace_id uuid, p_prospect_id uuid, p_expected_version bigint,
  p_idempotency_key text, p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prospect_row public.prospects%rowtype;
  contact_id uuid;
  opportunity_id uuid;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into prospect_row from public.prospects where workspace_id = p_workspace_id and id = p_prospect_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'prospect-not-found'; end if;
  if prospect_row.version <> p_expected_version then
    return public.rpc_conflict('prospect', prospect_row.id, p_expected_version, prospect_row.version, to_jsonb(prospect_row));
  end if;
  select response_body into response from public.idempotency_keys
    where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'convert_prospect' and key = p_idempotency_key;
  if response is not null then return response; end if;

  contact_id := gen_random_uuid();
  opportunity_id := gen_random_uuid();
  insert into public.contacts (id, workspace_id, name, company, phone, email, preferred_channel)
    values (contact_id, p_workspace_id, prospect_row.name, prospect_row.company, prospect_row.phone, prospect_row.email, prospect_row.preferred_channel);
  insert into public.opportunities (id, workspace_id, contact_id, name, address, responsible_seller, pipeline_stage)
    values (opportunity_id, p_workspace_id, contact_id, prospect_row.potential_service, prospect_row.address, prospect_row.responsible, 'opportunity');
  update public.prospects set status = 'converted', conversion = jsonb_build_object('contactId', contact_id, 'opportunityId', opportunity_id), version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = p_prospect_id and version = p_expected_version;
  if not found then raise exception using errcode = '40001', message = 'concurrent-update'; end if;
  response := jsonb_build_object('code', 'OK', 'contactId', contact_id, 'opportunityId', opportunity_id, 'version', prospect_row.version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'convert_prospect', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), 'convert', 'prospect', p_prospect_id, p_request_id, p_idempotency_key, to_jsonb(prospect_row), jsonb_build_object('status', 'converted', 'contactId', contact_id, 'opportunityId', opportunity_id), 'success');
  return response;
end;
$$;

revoke all on function public.create_prospect(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.create_prospect(uuid, uuid, jsonb, text, text) to authenticated;
revoke all on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) from public;
grant execute on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) to authenticated;
revoke all on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) from public;
grant execute on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) to authenticated;
