-- SCRUM-111: archive and restore prospects without deleting them or their history.
-- Uses the existing prospects.archived_at column. The other prospect RPCs keep ignoring archived
-- rows (archived_at is null), so an archived prospect is read-only until it is restored.

create or replace function public.set_prospect_archived(
  p_workspace_id uuid,
  p_prospect_id uuid,
  p_expected_version bigint,
  p_archived boolean,
  p_reason text,
  p_author text,
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
  operation_name text := case when p_archived then 'archive_prospect' else 'restore_prospect' end;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = operation_name and key = p_idempotency_key;
  if response is not null then return response; end if;

  if p_archived and coalesce(btrim(p_reason), '') = '' then
    return jsonb_build_object('code', 'VALIDATION', 'field', 'reason');
  end if;

  select * into current_prospect from public.prospects
  where workspace_id = p_workspace_id and id = p_prospect_id
    and (case when p_archived then archived_at is null else archived_at is not null end)
  for update;
  if not found then return jsonb_build_object('code', 'NOT_FOUND'); end if;
  if current_prospect.version <> p_expected_version then
    return jsonb_build_object('code', 'CONFLICT', 'version', current_prospect.version);
  end if;

  update public.prospects
  set archived_at = case when p_archived then now() else null end,
      version = version + 1,
      updated_at = now()
  where workspace_id = p_workspace_id and id = p_prospect_id
  returning * into updated_prospect;

  -- Stored as a note so clients that only know the existing activity types keep reading it.
  insert into public.activities (
    id, workspace_id, prospect_id, type, occurred_at, author_id, result, note, source, communication
  ) values (
    gen_random_uuid(), p_workspace_id, p_prospect_id, 'note', now(), auth.uid(), '',
    case
      when p_archived then 'Archivado: ' || left(btrim(p_reason), 300) || '.'
      else 'Restaurado desde archivados.'
    end,
    'manual',
    jsonb_strip_nulls(jsonb_build_object('responsible', nullif(btrim(coalesce(p_author, '')), '')))
  );

  response := jsonb_build_object(
    'code', 'OK',
    'version', updated_prospect.version,
    'archivedAt', updated_prospect.archived_at,
    'idempotent', false
  );
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
  values (p_workspace_id, auth.uid(), operation_name, p_idempotency_key,
    coalesce(p_request_id, ''), 200, response);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
  values (p_workspace_id, auth.uid(), case when p_archived then 'archive' else 'restore' end,
    'prospect', p_prospect_id, p_request_id, p_idempotency_key,
    to_jsonb(current_prospect), to_jsonb(updated_prospect), 'success');
  return response;
end;
$$;

revoke all on function public.set_prospect_archived(uuid, uuid, bigint, boolean, text, text, text, text) from public;
grant execute on function public.set_prospect_archived(uuid, uuid, bigint, boolean, text, text, text, text) to authenticated;
