-- SCRUM-79: first commercial repository slice (prospects).

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
  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id
    and actor_id = auth.uid()
    and operation = 'create_prospect'
    and key = p_idempotency_key;
  if response is not null then return response; end if;

  insert into public.prospects (
    id, workspace_id, name, company, phone, email, source, potential_service,
    notes, status, priority, priority_reason, next_action, next_action_at,
    responsible, preferred_channel
  )
  values (
    p_prospect_id,
    p_workspace_id,
    coalesce(p_payload->>'name', ''),
    coalesce(p_payload->>'company', ''),
    coalesce(p_payload->>'phone', ''),
    coalesce(p_payload->>'email', ''),
    coalesce(p_payload->>'source', ''),
    coalesce(p_payload->>'potentialService', ''),
    coalesce(p_payload->>'notes', ''),
    coalesce(p_payload->>'status', 'uncontacted'),
    coalesce(p_payload->>'priority', 'medium'),
    coalesce(p_payload->>'priorityReason', ''),
    coalesce(p_payload->>'nextAction', ''),
    nullif(p_payload->>'nextActionAt', '')::timestamptz,
    coalesce(p_payload->>'responsible', ''),
    nullif(p_payload->>'preferredChannel', '')
  )
  on conflict (workspace_id, id) do nothing;

  response := jsonb_build_object('code', 'OK', 'entity', 'prospect', 'entityId', p_prospect_id, 'version', 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'create_prospect', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result)
    values (p_workspace_id, auth.uid(), 'create', 'prospect', p_prospect_id, p_request_id, p_idempotency_key, p_payload, 'success');
  return response;
end;
$$;

revoke all on function public.create_prospect(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.create_prospect(uuid, uuid, jsonb, text, text) to authenticated;
