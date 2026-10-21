-- SCRUM-84: records a quote send atomically. The UI never sends the external message.
create or replace function public.register_quote_send(
  p_workspace_id uuid, p_quote_version_id uuid, p_expected_version bigint,
  p_channel text, p_recipient text, p_sent_at timestamptz, p_note text,
  p_idempotency_key text, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare quote_row public.quotes%rowtype; version_row public.quote_versions%rowtype; send_id uuid := gen_random_uuid(); response jsonb;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response from public.idempotency_keys where workspace_id=p_workspace_id and actor_id=auth.uid() and operation='register_quote_send' and key=p_idempotency_key;
  if response is not null then return response; end if;
  select * into version_row from public.quote_versions where workspace_id=p_workspace_id and id=p_quote_version_id for update;
  if not found or version_row.status <> 'draft' then raise exception using errcode='P0002', message='quote-version-not-sendable'; end if;
  select * into quote_row from public.quotes where workspace_id=p_workspace_id and id=version_row.quote_id for update;
  if quote_row.version <> p_expected_version then return public.rpc_conflict('quote', quote_row.id, p_expected_version, quote_row.version, to_jsonb(quote_row)); end if;
  insert into public.quote_sends (id, workspace_id, quote_version_id, channel, recipient, sent_at, sent_by, idempotency_key) values (send_id,p_workspace_id,p_quote_version_id,p_channel,p_recipient,p_sent_at,auth.uid(),p_idempotency_key);
  update public.quote_versions set status='sent' where workspace_id=p_workspace_id and id=p_quote_version_id;
  update public.quotes set commercial_status='sent', version=version+1, updated_at=now() where workspace_id=p_workspace_id and id=quote_row.id;
  insert into public.activities (workspace_id, quote_id, type, occurred_at, author_id, result, note, source, event) values (p_workspace_id, quote_row.id, 'note', p_sent_at, auth.uid(), 'sent', coalesce(p_note,''), 'quote_send', 'sent');
  response:=jsonb_build_object('code','OK','sendId',send_id,'version',p_expected_version+1);
  insert into public.idempotency_keys (workspace_id,actor_id,operation,key,request_hash,response_status,response_body) values (p_workspace_id,auth.uid(),'register_quote_send',p_idempotency_key,coalesce(p_request_id,''),200,response);
  return response;
end; $$;
revoke all on function public.register_quote_send(uuid,uuid,bigint,text,text,timestamptz,text,text,text) from public;
grant execute on function public.register_quote_send(uuid,uuid,bigint,text,text,timestamptz,text,text,text) to authenticated;
