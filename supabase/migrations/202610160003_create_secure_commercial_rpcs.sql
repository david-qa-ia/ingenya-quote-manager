-- SCRUM-79: server-owned commercial mutations.
-- The browser can select rows under SCRUM-78 RLS, but every mutation goes through one of these
-- security-definer functions. No password or service-role secret is used here.

create or replace function public.assert_commercial_rpc_access(
  target_workspace_id uuid,
  owner_only boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  required_roles text[] := case when owner_only then array['owner'] else array['owner', 'admin'] end;
begin
  if auth.uid() is null or not public.has_workspace_role(target_workspace_id, required_roles) then
    raise exception using errcode = '42501', message = 'workspace-access-denied';
  end if;
end;
$$;

revoke all on function public.assert_commercial_rpc_access(uuid, boolean) from public;

create or replace function public.rpc_conflict(
  entity_name text,
  entity_identifier uuid,
  expected_version bigint,
  current_version bigint,
  remote_data jsonb
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'code', 'CONFLICT',
    'entity', entity_name,
    'entityId', entity_identifier,
    'expectedVersion', expected_version,
    'currentVersion', current_version,
    'remoteData', coalesce(remote_data, '{}'::jsonb)
  );
$$;

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
    values (opportunity_id, p_workspace_id, contact_id, prospect_row.potential_service, '', prospect_row.responsible, 'opportunity');
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

create or replace function public.complete_or_reschedule_next_action(
  p_workspace_id uuid,
  p_action_id uuid,
  p_expected_version bigint,
  p_status text,
  p_due_at timestamptz,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.next_actions%rowtype;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into action_row from public.next_actions where workspace_id = p_workspace_id and id = p_action_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'next-action-not-found'; end if;
  if action_row.version <> p_expected_version then
    return public.rpc_conflict('next_action', action_row.id, p_expected_version, action_row.version, to_jsonb(action_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'complete_next_action' and key = p_idempotency_key;
  if response is not null then return response; end if;
  update public.next_actions set status = p_status, due_at = coalesce(p_due_at, due_at), version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = p_action_id and version = p_expected_version;
  response := jsonb_build_object('code', 'OK', 'entity', 'next_action', 'entityId', p_action_id, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'complete_next_action', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result) values (p_workspace_id, auth.uid(), 'update', 'next_action', p_action_id, p_request_id, p_idempotency_key, to_jsonb(action_row), jsonb_build_object('status', p_status, 'dueAt', p_due_at), 'success');
  return response;
end;
$$;

create or replace function public.register_contact_result(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_expected_version bigint,
  p_result text,
  p_note text,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_row public.contacts%rowtype;
  activity_id uuid := gen_random_uuid();
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into contact_row from public.contacts where workspace_id = p_workspace_id and id = p_contact_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'contact-not-found'; end if;
  if contact_row.version <> p_expected_version then
    return public.rpc_conflict('contact', contact_row.id, p_expected_version, contact_row.version, to_jsonb(contact_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'register_contact_result' and key = p_idempotency_key;
  if response is not null then return response; end if;
  insert into public.activities (id, workspace_id, contact_id, type, occurred_at, author_id, result, note, source)
    values (activity_id, p_workspace_id, p_contact_id, 'contact_result', now(), auth.uid(), p_result, p_note, 'rpc');
  update public.contacts set version = version + 1, updated_at = now() where workspace_id = p_workspace_id and id = p_contact_id and version = p_expected_version;
  response := jsonb_build_object('code', 'OK', 'activityId', activity_id, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'register_contact_result', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result) values (p_workspace_id, auth.uid(), 'record', 'contact', p_contact_id, p_request_id, p_idempotency_key, jsonb_build_object('activityId', activity_id, 'result', p_result), 'success');
  return response;
end;
$$;

create or replace function public.record_commercial_outcome(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_quote_id uuid,
  p_type text,
  p_reason_code text,
  p_note text,
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
  opportunity_row public.opportunities%rowtype;
  outcome_id uuid := gen_random_uuid();
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into opportunity_row from public.opportunities where workspace_id = p_workspace_id and id = p_opportunity_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'opportunity-not-found'; end if;
  if opportunity_row.version <> p_expected_version then
    return public.rpc_conflict('opportunity', opportunity_row.id, p_expected_version, opportunity_row.version, to_jsonb(opportunity_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'record_outcome' and key = p_idempotency_key;
  if response is not null then return response; end if;
  insert into public.commercial_outcomes (id, workspace_id, opportunity_id, quote_id, type, reason_code, note, author_id)
    values (outcome_id, p_workspace_id, p_opportunity_id, p_quote_id, p_type, p_reason_code, p_note, auth.uid());
  update public.opportunities set commercial_state = case when p_type = 'won' then 'won' when p_type = 'lost' then 'lost' else commercial_state end, version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = p_opportunity_id and version = p_expected_version;
  response := jsonb_build_object('code', 'OK', 'outcomeId', outcome_id, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'record_outcome', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result) values (p_workspace_id, auth.uid(), 'record', 'commercial_outcome', outcome_id, p_request_id, p_idempotency_key, null, jsonb_build_object('type', p_type, 'opportunityId', p_opportunity_id), 'success');
  return response;
end;
$$;

create or replace function public.execute_cadence_step(
  p_workspace_id uuid,
  p_step_execution_id uuid,
  p_expected_version bigint,
  p_result text,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  step_row public.cadence_step_executions%rowtype;
  event_id uuid := gen_random_uuid();
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into step_row from public.cadence_step_executions where workspace_id = p_workspace_id and id = p_step_execution_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'cadence-step-not-found'; end if;
  if step_row.version <> p_expected_version then
    return public.rpc_conflict('cadence_step_execution', step_row.id, p_expected_version, step_row.version, to_jsonb(step_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'execute_cadence_step' and key = p_idempotency_key;
  if response is not null then return response; end if;
  update public.cadence_step_executions set status = 'completed', result = p_result, version = version + 1 where workspace_id = p_workspace_id and id = p_step_execution_id and version = p_expected_version;
  insert into public.cadence_events (id, workspace_id, execution_id, step_execution_id, type, actor_id, reason) values (event_id, p_workspace_id, step_row.execution_id, p_step_execution_id, 'completed', auth.uid(), coalesce(p_result, ''));
  response := jsonb_build_object('code', 'OK', 'eventId', event_id, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'execute_cadence_step', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result) values (p_workspace_id, auth.uid(), 'execute', 'cadence_step_execution', p_step_execution_id, p_request_id, p_idempotency_key, response, 'success');
  return response;
end;
$$;

create or replace function public.create_quote_version(
  p_workspace_id uuid,
  p_quote_id uuid,
  p_expected_version bigint,
  p_lines jsonb,
  p_change_request jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.quotes%rowtype;
  version_id uuid := gen_random_uuid();
  next_version integer;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into quote_row from public.quotes where workspace_id = p_workspace_id and id = p_quote_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'quote-not-found'; end if;
  if quote_row.version <> p_expected_version then
    return public.rpc_conflict('quote', quote_row.id, p_expected_version, quote_row.version, to_jsonb(quote_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'create_quote_version' and key = p_idempotency_key;
  if response is not null then return response; end if;
  next_version := quote_row.current_version + 1;
  insert into public.quote_versions (id, workspace_id, quote_id, version_number, based_on_version_id, status, lines, change_request, created_by)
    values (version_id, p_workspace_id, p_quote_id, next_version,
      (select id from public.quote_versions where workspace_id = p_workspace_id and quote_id = p_quote_id and version_number = quote_row.current_version),
      'draft', coalesce(p_lines, '[]'::jsonb), p_change_request, auth.uid());
  update public.quotes set current_version = next_version, version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = p_quote_id and version = p_expected_version;
  response := jsonb_build_object('code', 'OK', 'quoteVersionId', version_id, 'versionNumber', next_version, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'create_quote_version', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result) values (p_workspace_id, auth.uid(), 'create', 'quote_version', version_id, p_request_id, p_idempotency_key, jsonb_build_object('quoteId', p_quote_id, 'versionNumber', next_version), 'success');
  return response;
end;
$$;

create or replace function public.send_quote_version(
  p_workspace_id uuid,
  p_quote_version_id uuid,
  p_expected_version bigint,
  p_channel text,
  p_recipient text,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row public.quote_versions%rowtype;
  quote_row public.quotes%rowtype;
  send_id uuid := gen_random_uuid();
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select * into version_row from public.quote_versions where workspace_id = p_workspace_id and id = p_quote_version_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'quote-version-not-found'; end if;
  select * into quote_row from public.quotes where workspace_id = p_workspace_id and id = version_row.quote_id for update;
  if quote_row.version <> p_expected_version then
    return public.rpc_conflict('quote', quote_row.id, p_expected_version, quote_row.version, to_jsonb(quote_row));
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_workspace_id and actor_id = auth.uid() and operation = 'send_quote_version' and key = p_idempotency_key;
  if response is not null then return response; end if;
  insert into public.quote_sends (id, workspace_id, quote_version_id, channel, recipient, sent_by, idempotency_key)
    values (send_id, p_workspace_id, p_quote_version_id, p_channel, p_recipient, auth.uid(), p_idempotency_key);
  update public.quote_versions set status = 'sent' where workspace_id = p_workspace_id and id = p_quote_version_id;
  update public.quotes set commercial_status = 'sent', version = version + 1, updated_at = now()
    where workspace_id = p_workspace_id and id = quote_row.id and version = p_expected_version;
  response := jsonb_build_object('code', 'OK', 'sendId', send_id, 'version', p_expected_version + 1);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_workspace_id, auth.uid(), 'send_quote_version', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result) values (p_workspace_id, auth.uid(), 'send', 'quote_version', p_quote_version_id, p_request_id, p_idempotency_key, jsonb_build_object('channel', p_channel, 'recipient', p_recipient), 'success');
  return response;
end;
$$;

create or replace function public.run_migration_batch(
  p_source_workspace_id uuid,
  p_destination_workspace_id uuid,
  p_snapshot_fingerprint text,
  p_snapshot_checksum text,
  p_records jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.migration_runs%rowtype;
  item jsonb;
  record_data jsonb;
  source_type text;
  source_id text;
  imported_count integer := 0;
  quarantined_count integer := 0;
  response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_source_workspace_id, true);
  perform public.assert_commercial_rpc_access(p_destination_workspace_id, true);
  select * into run_row from public.migration_runs
    where source_workspace_id = p_source_workspace_id
      and destination_workspace_id = p_destination_workspace_id
      and snapshot_fingerprint = p_snapshot_fingerprint
    for update;
  if not found then
    insert into public.migration_runs (source_workspace_id, destination_workspace_id, snapshot_fingerprint, snapshot_checksum, status, started_by)
      values (p_source_workspace_id, p_destination_workspace_id, p_snapshot_fingerprint, p_snapshot_checksum, 'running', auth.uid())
      returning * into run_row;
  elsif run_row.snapshot_checksum <> p_snapshot_checksum then
    raise exception using errcode = '23505', message = 'migration-fingerprint-checksum-mismatch';
  end if;
  select response_body into response from public.idempotency_keys where workspace_id = p_destination_workspace_id and actor_id = auth.uid() and operation = 'migration_batch' and key = p_idempotency_key;
  if response is not null then return response; end if;

  for item in select value from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) loop
    source_type := item->>'source_type';
    source_id := item->>'source_id';
    record_data := item->'record';
    begin
      if source_type = 'prospect'
         and source_id is not null
         and (record_data->>'name') is not null
         and (record_data->>'id')::uuid is not null then
        insert into public.prospects (id, workspace_id, name, company, phone, email, source, potential_service, notes, status, priority, priority_reason, next_action, next_action_at, responsible, preferred_channel)
          values ((record_data->>'id')::uuid, p_destination_workspace_id, coalesce(record_data->>'name', ''), coalesce(record_data->>'company', ''), coalesce(record_data->>'phone', ''), coalesce(record_data->>'email', ''), coalesce(record_data->>'source', ''), coalesce(record_data->>'potential_service', ''), coalesce(record_data->>'notes', ''), coalesce(record_data->>'status', 'new'), coalesce(record_data->>'priority', 'medium'), coalesce(record_data->>'priority_reason', ''), coalesce(record_data->>'next_action', ''), nullif(record_data->>'next_action_at', '')::timestamptz, coalesce(record_data->>'responsible', ''), nullif(record_data->>'preferred_channel', ''))
          on conflict (workspace_id, id) do nothing;
        insert into public.migration_items (migration_run_id, source_type, source_id, destination_type, destination_id, status, processed_at)
          values (run_row.id, source_type, source_id, 'prospect', (record_data->>'id')::uuid, 'imported', now())
          on conflict (migration_run_id, source_type, source_id) do update set status = 'imported', processed_at = now();
        imported_count := imported_count + 1;
      else
        raise exception using message = 'invalid-or-unsupported-record';
      end if;
    exception when others then
      insert into public.migration_quarantine (migration_run_id, source_type, source_id, raw_record, reason)
        values (run_row.id, coalesce(source_type, 'unknown'), coalesce(source_id, ''), coalesce(record_data, item), sqlerrm)
        on conflict (migration_run_id, source_type, source_id) do update set reason = excluded.reason;
      quarantined_count := quarantined_count + 1;
    end;
  end loop;
  update public.migration_runs set status = 'running', imported_counts = jsonb_build_object('batch', imported_count), quarantined_counts = jsonb_build_object('batch', quarantined_count), checkpoint = jsonb_build_object('lastRequestId', p_request_id), updated_at = now() where id = run_row.id;
  response := jsonb_build_object('code', 'OK', 'migrationRunId', run_row.id, 'imported', imported_count, 'quarantined', quarantined_count, 'resumable', true);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body) values (p_destination_workspace_id, auth.uid(), 'migration_batch', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, after_state, result) values (p_destination_workspace_id, auth.uid(), 'migration_batch', 'migration_run', run_row.id, p_request_id, p_idempotency_key, response, 'success');
  return response;
end;
$$;

revoke all on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) from public;
revoke all on function public.complete_or_reschedule_next_action(uuid, uuid, bigint, text, timestamptz, text, text) from public;
revoke all on function public.register_contact_result(uuid, uuid, bigint, text, text, text, text) from public;
revoke all on function public.record_commercial_outcome(uuid, uuid, uuid, text, text, text, bigint, text, text) from public;
revoke all on function public.execute_cadence_step(uuid, uuid, bigint, text, text, text) from public;
revoke all on function public.create_quote_version(uuid, uuid, bigint, jsonb, jsonb, text, text) from public;
revoke all on function public.send_quote_version(uuid, uuid, bigint, text, text, text, text) from public;
revoke all on function public.run_migration_batch(uuid, uuid, text, text, jsonb, text, text) from public;
grant execute on function public.convert_prospect_to_opportunity(uuid, uuid, bigint, text, text) to authenticated;
grant execute on function public.complete_or_reschedule_next_action(uuid, uuid, bigint, text, timestamptz, text, text) to authenticated;
grant execute on function public.register_contact_result(uuid, uuid, bigint, text, text, text, text) to authenticated;
grant execute on function public.record_commercial_outcome(uuid, uuid, uuid, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.execute_cadence_step(uuid, uuid, bigint, text, text, text) to authenticated;
grant execute on function public.create_quote_version(uuid, uuid, bigint, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.send_quote_version(uuid, uuid, bigint, text, text, text, text) to authenticated;
grant execute on function public.run_migration_batch(uuid, uuid, text, text, jsonb, text, text) to authenticated;
