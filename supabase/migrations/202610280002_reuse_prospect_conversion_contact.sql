-- SCRUM-99: conversion reuses an existing contact and retains the prospect source.

create or replace function public.convert_prospect_to_opportunity(
  p_workspace_id uuid,
  p_prospect_id uuid,
  p_expected_version bigint,
  p_idempotency_key text,
  p_request_id text default null
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
  normalized_phone text;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);

  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id
    and actor_id = auth.uid()
    and operation = 'convert_prospect'
    and key = p_idempotency_key;
  if response is not null then return response; end if;

  select * into prospect_row
  from public.prospects
  where workspace_id = p_workspace_id and id = p_prospect_id and archived_at is null
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'prospect-not-found'; end if;
  if prospect_row.version <> p_expected_version then
    return public.rpc_conflict('prospect', prospect_row.id, p_expected_version, prospect_row.version, to_jsonb(prospect_row));
  end if;

  normalized_phone := regexp_replace(prospect_row.phone, '\D', '', 'g');
  select contact.id into contact_id
  from public.contacts contact
  where contact.workspace_id = p_workspace_id
    and contact.archived_at is null
    and (
      (
        nullif(lower(btrim(prospect_row.email)), '') is not null
        and lower(btrim(prospect_row.email)) <> 'none'
        and lower(btrim(contact.email)) = lower(btrim(prospect_row.email))
      )
      or (
        length(normalized_phone) >= 7
        and normalized_phone <> '1111111111'
        and regexp_replace(contact.phone, '\D', '', 'g') = normalized_phone
      )
    )
  order by contact.created_at asc
  limit 1
  for update;

  if contact_id is null then
    contact_id := gen_random_uuid();
    insert into public.contacts (id, workspace_id, name, company, phone, email, preferred_channel)
    values (
      contact_id,
      p_workspace_id,
      prospect_row.name,
      prospect_row.company,
      prospect_row.phone,
      prospect_row.email,
      prospect_row.preferred_channel
    );
  end if;

  opportunity_id := gen_random_uuid();
  insert into public.opportunities (
    id, workspace_id, contact_id, name, address, responsible_seller, origin, pipeline_stage
  ) values (
    opportunity_id,
    p_workspace_id,
    contact_id,
    prospect_row.potential_service,
    prospect_row.address,
    prospect_row.responsible,
    nullif(prospect_row.source, ''),
    'opportunity'
  );

  update public.prospects
  set
    status = 'converted',
    conversion = jsonb_build_object('contactId', contact_id, 'opportunityId', opportunity_id),
    version = version + 1,
    updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id and version = p_expected_version;
  if not found then raise exception using errcode = '40001', message = 'concurrent-update'; end if;

  response := jsonb_build_object(
    'code', 'OK',
    'contactId', contact_id,
    'opportunityId', opportunity_id,
    'version', prospect_row.version + 1
  );
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (
    p_workspace_id,
    auth.uid(),
    'convert_prospect',
    p_idempotency_key,
    coalesce(p_request_id, ''),
    200,
    response
  );
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
  values (
    p_workspace_id,
    auth.uid(),
    'convert',
    'prospect',
    p_prospect_id,
    p_request_id,
    p_idempotency_key,
    to_jsonb(prospect_row),
    jsonb_build_object('status', 'converted', 'contactId', contact_id, 'opportunityId', opportunity_id),
    'success'
  );
  return response;
end;
$$;

revoke all on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) from public;
grant execute on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) to authenticated;
