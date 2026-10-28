-- SCRUM-96: prospects must not disappear without an explicit, audited product action.
-- There is currently no product-level archival or deletion flow, so hard deletes are forbidden.

create or replace function public.prevent_prospect_hard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'prospect-hard-delete-forbidden',
    detail = 'Prospects must be retained until an explicit audited archival flow is implemented.';
end;
$$;

drop trigger if exists prevent_prospect_hard_delete on public.prospects;
create trigger prevent_prospect_hard_delete
before delete on public.prospects
for each row execute function public.prevent_prospect_hard_delete();

-- Profile changes are part of the prospect traceability and therefore need an audit event.
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
  updated_prospect public.prospects%rowtype;
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
  where workspace_id = p_workspace_id and id = p_prospect_id
  returning * into updated_prospect;

  response := jsonb_build_object('code', 'OK', 'version', updated_prospect.version, 'idempotent', false);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'update_prospect_profile', p_idempotency_key,
    coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
  values (p_workspace_id, auth.uid(), 'update', 'prospect', p_prospect_id, p_request_id, p_idempotency_key,
    to_jsonb(current_prospect), to_jsonb(updated_prospect), 'success');
  return response;
end;
$$;

revoke all on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) from public;
grant execute on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) to authenticated;
