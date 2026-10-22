-- SCRUM-87: atomic prospect result / next-step persistence and Instagram profile support.
alter table public.prospects add column if not exists instagram text not null default '';

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
    when p_follow_up_at is not null and current_prospect.status in ('uncontacted', 'contactToday') then current_prospect.status
    when p_result = 'noResponse' then 'noResponse'
    when p_result = 'discarded' then 'notInterested'
    else 'contacted'
  end;

  update public.prospects
  set status = next_status,
      next_action = case when p_follow_up_at is null then '' else 'Retomar contacto' end,
      next_action_at = p_follow_up_at,
      responsible = coalesce(p_responsible, ''),
      preferred_channel = case when p_channel = 'call' then 'phone' else p_channel end,
      version = version + 1,
      updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id;

  insert into public.activities (
    id, workspace_id, prospect_id, type, occurred_at, author_id, result, note, source, communication
  ) values (
    gen_random_uuid(), p_workspace_id, p_prospect_id, 'contactResult', now(), auth.uid(),
    coalesce(p_result, ''), coalesce(p_note, ''), 'manual',
    jsonb_build_object('channel', p_channel, 'followUpAt', p_follow_up_at, 'responsible', p_responsible)
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
