-- SCRUM-103: prospect traceability.
-- * update_prospect_profile records the edited fields (summary sent by the client) as a prospect
--   activity, in addition to the audit_events row added in SCRUM-96.
-- * register_prospect_result keeps the replaced follow-up date (previousFollowUpAt) so a
--   rescheduled next step shows the previous and the new date.
-- Function signatures are unchanged; existing rows are not rewritten.

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
  -- SCRUM-103: the edit is also visible in the prospect history. Stored as a note so clients that
  -- only know the existing activity types keep reading the prospect.
  if coalesce(p_payload->>'changeSummary', '') <> '' then
    insert into public.activities (
      id, workspace_id, prospect_id, type, occurred_at, author_id, result, note, source, communication
    ) values (
      gen_random_uuid(), p_workspace_id, p_prospect_id, 'note', now(), auth.uid(), '',
      left(p_payload->>'changeSummary', 2000), 'manual',
      jsonb_build_object('responsible', nullif(p_payload->>'changeAuthor', ''))
    );
  end if;
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
  values (p_workspace_id, auth.uid(), 'update', 'prospect', p_prospect_id, p_request_id, p_idempotency_key,
    to_jsonb(current_prospect), to_jsonb(updated_prospect), 'success');
  return response;
end;
$$;

revoke all on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) from public;
grant execute on function public.update_prospect_profile(uuid, uuid, bigint, jsonb, text, text) to authenticated;

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
  next_status text;
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
    else 'contacted'
  end;

  update public.prospects
  set status = next_status,
      next_action = case when p_follow_up_at is null then '' else 'Retomar contacto' end,
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
      'previousFollowUpAt', case
        when p_follow_up_at is not null and current_prospect.next_action_at is not null
          and current_prospect.next_action_at <> p_follow_up_at
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

revoke all on function public.register_prospect_result(uuid, uuid, bigint, text, text, text, timestamptz, text, text, text) from public;
grant execute on function public.register_prospect_result(uuid, uuid, bigint, text, text, text, timestamptz, text, text, text) to authenticated;
