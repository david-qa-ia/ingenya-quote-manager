-- SCRUM-113 (SCRUM-62, fase 1): contacts are created and edited in Supabase.
-- The browser keeps a mirror for reads; writes go through this RPC with version check,
-- idempotency and audit. Creating a contact whose email or phone already belongs to an active
-- contact returns DUPLICATE instead of creating a second one (same rule as SCRUM-99).

create or replace function public.save_contact(
  p_workspace_id uuid,
  p_contact_id uuid,
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
  current_contact public.contacts%rowtype;
  saved_contact public.contacts%rowtype;
  duplicate_contact public.contacts%rowtype;
  response jsonb;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_company text := nullif(btrim(coalesce(p_payload->>'company', '')), '');
  v_phone text := btrim(coalesce(p_payload->>'phone', ''));
  v_email text := btrim(coalesce(p_payload->>'email', ''));
  v_phone_digits text := regexp_replace(btrim(coalesce(p_payload->>'phone', '')), '\D', '', 'g');
  v_is_create boolean := p_expected_version is null;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'save_contact' and key = p_idempotency_key;
  if response is not null then return response; end if;

  if v_name = '' and v_company is null then
    return jsonb_build_object('code', 'VALIDATION', 'field', 'name');
  end if;

  if v_is_create then
    select * into duplicate_contact from public.contacts c
    where c.workspace_id = p_workspace_id and c.archived_at is null
      and (
        (v_email <> '' and lower(v_email) <> 'none' and lower(btrim(c.email)) = lower(v_email))
        or (length(v_phone_digits) >= 7 and v_phone_digits <> '1111111111'
            and regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits)
      )
    order by c.created_at asc
    limit 1;
    if found then
      return jsonb_build_object('code', 'DUPLICATE', 'contactId', duplicate_contact.id,
        'name', coalesce(nullif(duplicate_contact.name, ''), duplicate_contact.company));
    end if;
    insert into public.contacts (
      id, workspace_id, name, company, phone, email, preferred_channel, contact_consent, do_not_contact
    ) values (
      p_contact_id, p_workspace_id, v_name, v_company, v_phone, v_email,
      nullif(p_payload->>'preferredChannel', ''),
      coalesce((p_payload->>'contactConsent')::boolean, false),
      p_payload->'doNotContact'
    )
    returning * into saved_contact;
  else
    select * into current_contact from public.contacts
    where workspace_id = p_workspace_id and id = p_contact_id and archived_at is null
    for update;
    if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
    if current_contact.version <> p_expected_version then
      return jsonb_build_object('code', 'CONFLICT', 'version', current_contact.version);
    end if;
    update public.contacts set
      name = v_name, company = v_company, phone = v_phone, email = v_email,
      preferred_channel = nullif(p_payload->>'preferredChannel', ''),
      contact_consent = coalesce((p_payload->>'contactConsent')::boolean, false),
      do_not_contact = case when jsonb_typeof(p_payload->'doNotContact') = 'object'
        then p_payload->'doNotContact' else null end,
      version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = p_contact_id
    returning * into saved_contact;
  end if;

  response := jsonb_build_object('code', 'OK', 'version', saved_contact.version,
    'updatedAt', saved_contact.updated_at, 'idempotent', false);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'save_contact', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
  values (p_workspace_id, auth.uid(), case when v_is_create then 'create' else 'update' end, 'contact',
    p_contact_id, p_request_id, p_idempotency_key,
    case when v_is_create then null else to_jsonb(current_contact) end, to_jsonb(saved_contact), 'success');
  return response;
end;
$$;

revoke all on function public.save_contact(uuid, uuid, bigint, jsonb, text, text) from public;
grant execute on function public.save_contact(uuid, uuid, bigint, jsonb, text, text) to authenticated;
