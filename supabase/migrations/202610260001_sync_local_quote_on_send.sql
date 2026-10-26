-- Syncs a locally created quote into Supabase as part of its first registered send.
create or replace function public.sync_and_register_local_quote_send(
  p_workspace_id uuid,
  p_payload jsonb,
  p_channel text,
  p_recipient text,
  p_sent_at timestamptz,
  p_note text,
  p_next_action jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid := gen_random_uuid();
  v_opportunity_id uuid;
  v_quote_id uuid := gen_random_uuid();
  v_quote_version_id uuid := gen_random_uuid();
  v_response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);

  if coalesce(p_payload->'client'->>'name', '') = ''
     or coalesce(p_payload->'quote'->>'localId', '') = '' then
    raise exception using message = 'local-quote-payload-invalid';
  end if;

  select response_body into v_response
  from public.idempotency_keys
  where workspace_id = p_workspace_id
    and actor_id = auth.uid()
    and operation = 'sync_and_register_local_quote_send'
    and key = p_idempotency_key;
  if v_response is not null then
    return jsonb_set(v_response, '{idempotent}', 'true'::jsonb);
  end if;

  insert into public.contacts (
    id, workspace_id, name, company, phone, email, preferred_channel, contact_consent, do_not_contact
  ) values (
    v_contact_id,
    p_workspace_id,
    p_payload->'client'->>'name',
    nullif(p_payload->'client'->>'company', ''),
    coalesce(p_payload->'client'->>'phone', ''),
    coalesce(p_payload->'client'->>'email', ''),
    nullif(p_payload->'client'->>'preferredChannel', ''),
    coalesce((p_payload->'client'->>'contactConsent')::boolean, false),
    p_payload->'client'->'doNotContact'
  );

  if p_payload->'opportunity' is not null then
    v_opportunity_id := gen_random_uuid();
    insert into public.opportunities (
      id, workspace_id, contact_id, name, address, estimated_start_date, responsible_seller,
      origin, tag, closing_probability, estimated_close_date, status, commercial_state, pipeline_stage
    ) values (
      v_opportunity_id,
      p_workspace_id,
      v_contact_id,
      coalesce(p_payload->'opportunity'->>'name', p_payload->'quote'->>'projectName', ''),
      coalesce(p_payload->'opportunity'->>'address', ''),
      nullif(p_payload->'opportunity'->>'estimatedStartDate', '')::date,
      coalesce(p_payload->'opportunity'->>'responsibleSeller', ''),
      nullif(p_payload->'opportunity'->>'origin', ''),
      nullif(p_payload->'opportunity'->>'tag', ''),
      nullif(p_payload->'opportunity'->>'closingProbability', '')::numeric,
      nullif(p_payload->'opportunity'->>'estimatedCloseDate', '')::date,
      'active',
      'open',
      'proposal'
    );
  end if;

  insert into public.quotes (
    id, workspace_id, opportunity_id, contact_id, current_version, commercial_status, version
  ) values (
    v_quote_id, p_workspace_id, v_opportunity_id, v_contact_id, 1, 'sent', 1
  );

  insert into public.quote_versions (
    id, workspace_id, quote_id, version_number, status, client_name, project_name, lines, created_by
  ) values (
    v_quote_version_id,
    p_workspace_id,
    v_quote_id,
    1,
    'sent',
    coalesce(p_payload->'quote'->>'clientName', p_payload->'client'->>'name', ''),
    coalesce(p_payload->'quote'->>'projectName', ''),
    coalesce(p_payload->'quote'->'lines', '[]'::jsonb),
    auth.uid()
  );

  insert into public.quote_sends (
    id, workspace_id, quote_version_id, channel, recipient, sent_at, sent_by, idempotency_key
  ) values (
    gen_random_uuid(), p_workspace_id, v_quote_version_id, p_channel, p_recipient,
    p_sent_at, auth.uid(), p_idempotency_key
  );

  if p_next_action is not null and v_opportunity_id is not null then
    insert into public.next_actions (
      id, workspace_id, opportunity_id, kind, type, description, due_at, responsible, priority
    ) values (
      gen_random_uuid(),
      p_workspace_id,
      v_opportunity_id,
      coalesce(p_next_action->>'kind', 'followUp'),
      p_next_action->>'type',
      coalesce(p_next_action->>'description', 'Dar seguimiento al presupuesto enviado'),
      (p_next_action->>'dueAt')::timestamptz,
      p_next_action->>'responsible',
      coalesce(p_next_action->>'priority', 'medium')
    );
  end if;

  insert into public.activities (
    workspace_id, quote_id, type, occurred_at, author_id, result, note, source, event
  ) values (
    p_workspace_id, v_quote_id, 'note', p_sent_at, auth.uid(), 'sent',
    coalesce(p_note, ''), 'quote_send', 'sent'
  );

  v_response := jsonb_build_object(
    'code', 'OK',
    'quoteId', v_quote_id,
    'quoteVersionId', v_quote_version_id,
    'version', 1
  );
  insert into public.idempotency_keys (
    workspace_id, actor_id, operation, key, request_hash, response_status, response_body
  ) values (
    p_workspace_id, auth.uid(), 'sync_and_register_local_quote_send', p_idempotency_key,
    coalesce(p_request_id, ''), 200, v_response
  );
  return v_response;
end;
$$;

revoke all on function public.sync_and_register_local_quote_send(
  uuid, jsonb, text, text, timestamptz, text, jsonb, text, text
) from public;

grant execute on function public.sync_and_register_local_quote_send(
  uuid, jsonb, text, text, timestamptz, text, jsonb, text, text
) to authenticated;
