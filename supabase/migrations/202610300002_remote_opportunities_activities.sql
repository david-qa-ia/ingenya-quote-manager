-- SCRUM-114 (SCRUM-62, fase 2): opportunities, their next step and contact/opportunity activity
-- are stored in Supabase. The browser keeps a copy; after each local operation the changed
-- records are sent here in one atomic call. If the call fails, the browser undoes the change.
--
-- The opportunity aggregate (qualification, next step and its history, no-next-step exception)
-- is stored as the `document` the app uses; the relational columns are kept in sync for queries.

alter table public.opportunities add column if not exists document jsonb;
alter table public.activities add column if not exists author_name text;

create or replace function public.sync_commercial_records(
  p_workspace_id uuid,
  p_contacts jsonb,
  p_opportunities jsonb,
  p_activities jsonb,
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
  doc jsonb;
  current_row public.opportunities%rowtype;
  saved_row public.opportunities%rowtype;
  versions jsonb := '{}'::jsonb;
  v_expected bigint;
  subject jsonb;
  v_detail text;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'sync_commercial_records' and key = p_idempotency_key;
  if response is not null then return response; end if;

  begin
    -- Contacts created in the browser together with an opportunity (for example a direct client).
    -- Existing contacts are never overwritten here; edits go through save_contact.
    for item in select * from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) loop
      insert into public.contacts (id, workspace_id, name, company, phone, email, preferred_channel, contact_consent, do_not_contact)
      values (
        (item->>'id')::uuid, p_workspace_id, coalesce(item->>'name', ''),
        nullif(btrim(coalesce(item->>'company', '')), ''), coalesce(item->>'phone', ''),
        coalesce(item->>'email', ''), nullif(item->>'preferredChannel', ''),
        coalesce((item->>'contactConsent')::boolean, false),
        case when jsonb_typeof(item->'doNotContact') = 'object' then item->'doNotContact' end
      )
      on conflict (id) do nothing;
    end loop;

    for item in select * from jsonb_array_elements(coalesce(p_opportunities, '[]'::jsonb)) loop
      doc := item->'data';
      v_expected := nullif(item->>'expectedVersion', '')::bigint;
      select * into current_row from public.opportunities
      where workspace_id = p_workspace_id and id = (doc->>'id')::uuid
      for update;
      if found then
        -- A row created by another flow (prospect conversion, quote send) has no document yet and
        -- is adopted by the first browser write; otherwise the version must match.
        if (v_expected is null and current_row.document is not null)
           or (v_expected is not null and current_row.version <> v_expected) then
          raise exception using errcode = 'P0001',
            message = 'CONFLICT', detail = (doc->>'id') || ':' || current_row.version;
        end if;
        update public.opportunities set
          contact_id = (doc->>'clientId')::uuid,
          name = coalesce(doc->>'name', ''),
          address = coalesce(doc->>'address', ''),
          estimated_start_date = nullif(doc->>'estimatedStartDate', '')::date,
          responsible_seller = coalesce(doc->>'responsibleSeller', ''),
          origin = nullif(doc->>'origin', ''),
          status = coalesce(doc->>'status', 'active'),
          commercial_state = coalesce(doc->>'commercialState', 'open'),
          pipeline_stage = coalesce(doc->>'pipelineStage', 'opportunity'),
          document = doc,
          version = version + 1,
          updated_at = now()
        where workspace_id = p_workspace_id and id = current_row.id
        returning * into saved_row;
      else
        if v_expected is not null then
          raise exception using errcode = 'P0001', message = 'CONFLICT', detail = (doc->>'id') || ':0';
        end if;
        insert into public.opportunities (
          id, workspace_id, contact_id, name, address, estimated_start_date, responsible_seller,
          origin, status, commercial_state, pipeline_stage, document
        ) values (
          (doc->>'id')::uuid, p_workspace_id, (doc->>'clientId')::uuid, coalesce(doc->>'name', ''),
          coalesce(doc->>'address', ''), nullif(doc->>'estimatedStartDate', '')::date,
          coalesce(doc->>'responsibleSeller', ''), nullif(doc->>'origin', ''),
          coalesce(doc->>'status', 'active'), coalesce(doc->>'commercialState', 'open'),
          coalesce(doc->>'pipelineStage', 'opportunity'), doc
        )
        returning * into saved_row;
      end if;
      versions := versions || jsonb_build_object(saved_row.id::text, saved_row.version);
      insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
      values (p_workspace_id, auth.uid(), case when current_row.id is null then 'create' else 'update' end,
        'opportunity', saved_row.id, p_request_id, p_idempotency_key,
        case when current_row.id is null then null else to_jsonb(current_row) end, to_jsonb(saved_row), 'success');
      current_row := null;
    end loop;

    -- Activity is append-only; only the note revisions of an existing entry can change.
    for item in select * from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) loop
      subject := item->'subject';
      insert into public.activities (
        id, workspace_id, contact_id, opportunity_id, type, occurred_at, author_id, author_name,
        result, note, source, event, communication, note_revisions
      ) values (
        (item->>'id')::uuid, p_workspace_id,
        case when subject->>'kind' = 'client' then (subject->>'clientId')::uuid end,
        case when subject->>'kind' = 'opportunity' then (subject->>'opportunityId')::uuid end,
        item->>'type', (item->>'occurredAt')::timestamptz, auth.uid(), item->>'author',
        coalesce(item->>'result', ''), coalesce(item->>'note', ''), item->>'source', item->>'event',
        item->'communication', coalesce(item->'noteRevisions', '[]'::jsonb)
      )
      on conflict (id) do update set note_revisions = excluded.note_revisions
      where public.activities.workspace_id = p_workspace_id;
    end loop;
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_detail = pg_exception_detail;
      return jsonb_build_object('code', 'CONFLICT', 'detail', v_detail);
    when foreign_key_violation then
      return jsonb_build_object('code', 'MISSING_REFERENCE');
  end;

  response := jsonb_build_object('code', 'OK', 'versions', versions);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), 'sync_commercial_records', p_idempotency_key, coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.sync_commercial_records(uuid, jsonb, jsonb, jsonb, text, text) from public;
grant execute on function public.sync_commercial_records(uuid, jsonb, jsonb, jsonb, text, text) to authenticated;
