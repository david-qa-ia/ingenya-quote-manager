-- SCRUM-82: imports every prospect and its optional first contact in one transaction.

create or replace function public.import_prospects_with_first_contact(
  p_workspace_id uuid,
  p_prospects jsonb,
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
  item jsonb;
  activity jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id
    and actor_id = auth.uid()
    and operation = 'import_prospects_with_first_contact'
    and key = p_idempotency_key;
  if response is not null then return response; end if;

  if jsonb_typeof(p_prospects) <> 'array' or jsonb_array_length(p_prospects) = 0 then
    raise exception 'The import must contain at least one prospect.';
  end if;

  for item in select value from jsonb_array_elements(p_prospects)
  loop
    insert into public.prospects (
      id, workspace_id, name, company, phone, email, source, potential_service,
      notes, status, priority, priority_reason, next_action, next_action_at,
      responsible, preferred_channel
    ) values (
      (item->>'id')::uuid, p_workspace_id,
      coalesce(item->>'name', ''), coalesce(item->>'company', ''),
      coalesce(item->>'phone', ''), coalesce(item->>'email', ''),
      coalesce(item->>'source', ''), coalesce(item->>'potentialService', ''),
      coalesce(item->>'notes', ''), coalesce(item->>'status', 'uncontacted'),
      coalesce(item->>'priority', 'medium'), coalesce(item->>'priorityReason', ''),
      coalesce(item->>'nextAction', ''), nullif(item->>'nextActionAt', '')::timestamptz,
      coalesce(item->>'responsible', ''), nullif(item->>'preferredChannel', '')
    ) on conflict (workspace_id, id) do nothing;

    for activity in select value from jsonb_array_elements(coalesce(item->'activities', '[]'::jsonb))
    loop
      insert into public.activities (
        id, workspace_id, prospect_id, type, occurred_at, author_id, note, source, event, communication
      ) values (
        (activity->>'id')::uuid, p_workspace_id, (item->>'id')::uuid,
        coalesce(activity->>'type', 'note'), (activity->>'occurredAt')::timestamptz,
        auth.uid(), coalesce(activity->>'note', activity->>'description', ''), 'prospect_import', 'created',
        jsonb_build_object('description', coalesce(activity->>'description', ''), 'channel', activity->>'channel')
      ) on conflict (workspace_id, id) do nothing;
    end loop;
  end loop;

  response := jsonb_build_object('code', 'OK', 'importedCount', jsonb_array_length(p_prospects));
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'import_prospects_with_first_contact', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, request_id, idempotency_key, after_state, result)
    values (p_workspace_id, auth.uid(), 'import', 'prospect', p_request_id, p_idempotency_key, p_prospects, 'success');
  return response;
end;
$$;

revoke all on function public.import_prospects_with_first_contact(uuid, jsonb, text, text) from public;
grant execute on function public.import_prospects_with_first_contact(uuid, jsonb, text, text) to authenticated;
