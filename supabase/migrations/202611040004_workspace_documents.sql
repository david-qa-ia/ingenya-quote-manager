-- SCRUM-123: quotes, the service catalog, contact scripts, cadences, commercial outcomes and
-- quote activity are stored in Supabase, so every member of a workspace sees the same data from
-- any browser. Each record is kept as the document the app uses (same shape as the browser
-- copy), one row per workspace, collection and id. Read with RLS (owner/admin); written only
-- through sync_workspace_documents, with expected version, idempotency and audit, all in one
-- transaction. A deleted record keeps a tombstone (deleted_at) so other browsers drop it too.

create table if not exists public.workspace_documents (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  collection text not null check (collection in (
    'savedQuotes', 'laborCatalog', 'contactScripts', 'cadenceTemplates', 'cadenceExecutions',
    'commercialOutcomes', 'quoteActivities'
  )),
  id text not null check (length(id) between 1 and 120),
  data jsonb,
  version bigint not null default 1,
  deleted_at timestamptz,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, collection, id),
  check ((deleted_at is null) = (data is not null))
);

alter table public.workspace_documents enable row level security;

drop policy if exists workspace_documents_workspace_isolation on public.workspace_documents;
create policy workspace_documents_workspace_isolation
  on public.workspace_documents for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

grant select on public.workspace_documents to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.workspace_documents from anon, authenticated;

-- p_changes: [{"collection", "id", "expectedVersion" (null for a new record), "data" (null to
-- delete)}]. All or nothing: any conflict or invalid change rolls the whole call back.
create or replace function public.sync_workspace_documents(
  p_workspace_id uuid,
  p_changes jsonb,
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
  current_row public.workspace_documents%rowtype;
  saved_row public.workspace_documents%rowtype;
  v_collection text;
  v_id text;
  v_expected bigint;
  v_data jsonb;
  versions jsonb := '{}'::jsonb;
  conflict jsonb;
  v_found boolean;
  v_current bigint;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'sync_workspace_documents' and key = p_idempotency_key;
  if response is not null then return response; end if;

  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0
    or jsonb_array_length(p_changes) > 500 then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'No hay cambios válidos para guardar.');
  end if;

  for item in select * from jsonb_array_elements(p_changes) loop
    v_collection := item->>'collection';
    v_id := item->>'id';
    v_expected := nullif(item->>'expectedVersion', '')::bigint;
    v_data := case when jsonb_typeof(item->'data') = 'object' then item->'data' end;
    if v_collection is null or v_id is null or length(v_id) not between 1 and 120
      or v_collection not in ('savedQuotes', 'laborCatalog', 'contactScripts', 'cadenceTemplates',
        'cadenceExecutions', 'commercialOutcomes', 'quoteActivities')
      or (v_data is not null and v_data->>'id' is distinct from v_id) then
      raise exception using errcode = '22023', message = 'invalid-document';
    end if;

    select * into current_row from public.workspace_documents
      where workspace_id = p_workspace_id and collection = v_collection and id = v_id
      for update;
    v_found := found;
    -- A tombstone counts as absent for a new record, so a deleted id can be created again.
    v_current := coalesce(current_row.version, 0);
    if v_found and current_row.deleted_at is not null and v_expected is null then
      v_current := 0;
    end if;
    if coalesce(v_expected, 0) <> v_current then
      conflict := jsonb_build_object('collection', v_collection, 'id', v_id,
        'version', coalesce(current_row.version, 0));
      raise exception using errcode = '40001', message = 'document-conflict';
    end if;

    if v_data is null then
      if not v_found or current_row.deleted_at is not null then
        continue; -- Deleting what is already gone is a no-op.
      end if;
      update public.workspace_documents
        set data = null, deleted_at = now(), version = version + 1, updated_by = auth.uid(),
            updated_at = now()
        where workspace_id = p_workspace_id and collection = v_collection and id = v_id
        returning * into saved_row;
    else
      insert into public.workspace_documents as doc (workspace_id, collection, id, data, updated_by)
        values (p_workspace_id, v_collection, v_id, v_data, auth.uid())
        on conflict (workspace_id, collection, id) do update
          set data = excluded.data, deleted_at = null, version = doc.version + 1,
              updated_by = auth.uid(), updated_at = now()
        returning * into saved_row;
    end if;

    versions := versions || jsonb_build_object(v_collection || ':' || v_id, saved_row.version);
    insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
      values (p_workspace_id, auth.uid(),
        case when v_data is null then 'delete' when current_row.workspace_id is null then 'create' else 'update' end,
        'workspace_document:' || v_collection, null, p_request_id, p_idempotency_key,
        case when current_row.workspace_id is null then null else to_jsonb(current_row) end,
        to_jsonb(saved_row), 'success');
  end loop;

  response := jsonb_build_object('code', 'OK', 'versions', versions, 'idempotent', false);
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'sync_workspace_documents', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
exception
  when sqlstate '40001' then
    -- Everything above is rolled back; the browser restores its copy and reloads this record.
    return jsonb_build_object('code', 'CONFLICT', 'conflict', conflict);
  when sqlstate '22023' then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Hay un registro inválido.');
end;
$$;

revoke all on function public.sync_workspace_documents(uuid, jsonb, text, text) from public;
grant execute on function public.sync_workspace_documents(uuid, jsonb, text, text) to authenticated;
