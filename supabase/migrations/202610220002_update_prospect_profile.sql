-- SCRUM-87: persist editable prospect profile fields, including Instagram.
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
    company = coalesce(p_payload->>'company', ''),
    phone = coalesce(p_payload->>'phone', ''),
    email = coalesce(p_payload->>'email', ''),
    instagram = coalesce(p_payload->>'instagram', ''),
    source = coalesce(p_payload->>'source', ''),
    potential_service = coalesce(p_payload->>'potentialService', ''),
    notes = coalesce(p_payload->>'notes', ''),
    priority = coalesce(p_payload->>'priority', current_prospect.priority),
    priority_reason = coalesce(p_payload->>'priorityReason', ''),
    responsible = coalesce(p_payload->>'responsible', ''),
    preferred_channel = nullif(p_payload->>'preferredChannel', ''),
    version = version + 1,
    updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id;

  select jsonb_build_object('code', 'OK', 'version', version, 'idempotent', false)
  into response from public.prospects where workspace_id = p_workspace_id and id = p_prospect_id;
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'update_prospect_profile', p_idempotency_key,
    coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;
revoke all on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) from public;
grant execute on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) to authenticated;
