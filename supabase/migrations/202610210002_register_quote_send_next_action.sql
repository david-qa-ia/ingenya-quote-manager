-- SCRUM-84: atomically records the optional follow-up alongside a quote send.
create or replace function public.register_quote_send_with_next_action(
  p_workspace_id uuid, p_quote_version_id uuid, p_expected_version bigint,
  p_channel text, p_recipient text, p_sent_at timestamptz, p_note text,
  p_next_action jsonb, p_next_action_decision text, p_idempotency_key text,
  p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.quote_versions%rowtype; q public.quotes%rowtype; r jsonb; existing uuid; begin
 perform public.assert_commercial_rpc_access(p_workspace_id);
 select response_body into r from public.idempotency_keys where workspace_id=p_workspace_id and actor_id=auth.uid() and operation='register_quote_send' and key=p_idempotency_key;
 if r is not null then return r; end if;
 select * into v from public.quote_versions where workspace_id=p_workspace_id and id=p_quote_version_id for update;
 if not found or v.status <> 'draft' then raise exception 'quote-version-not-sendable'; end if;
 select * into q from public.quotes where workspace_id=p_workspace_id and id=v.quote_id for update;
 if q.version <> p_expected_version then return public.rpc_conflict('quote',q.id,p_expected_version,q.version,to_jsonb(q)); end if;
 if p_next_action is not null and q.opportunity_id is null then raise exception 'quote-has-no-opportunity-for-next-action'; end if;
 select id into existing from public.next_actions where workspace_id=p_workspace_id and opportunity_id=q.opportunity_id and status='pending' limit 1 for update;
 if p_next_action is not null and existing is not null and p_next_action_decision not in ('preserve','replace') then raise exception 'next-action-decision-required'; end if;
 if p_next_action is not null and (existing is null or p_next_action_decision='replace') then
   if existing is not null then update public.next_actions set status='cancelled',updated_at=now() where workspace_id=p_workspace_id and id=existing; end if;
   insert into public.next_actions(workspace_id,opportunity_id,kind,type,description,due_at,responsible,priority) values(p_workspace_id,q.opportunity_id,coalesce(p_next_action->>'kind','followUp'),p_next_action->>'type',p_next_action->>'description',(p_next_action->>'dueAt')::timestamptz,p_next_action->>'responsible',coalesce(p_next_action->>'priority','medium'));
 end if;
 insert into public.quote_sends(id,workspace_id,quote_version_id,channel,recipient,sent_at,sent_by,idempotency_key) values(gen_random_uuid(),p_workspace_id,p_quote_version_id,p_channel,p_recipient,p_sent_at,auth.uid(),p_idempotency_key);
 update public.quote_versions set status='sent' where workspace_id=p_workspace_id and id=p_quote_version_id;
 update public.quotes set commercial_status='sent',version=version+1,updated_at=now() where workspace_id=p_workspace_id and id=q.id;
 insert into public.activities(workspace_id,quote_id,type,occurred_at,author_id,result,note,source,event) values(p_workspace_id,q.id,'note',p_sent_at,auth.uid(),'sent',coalesce(p_note,''),'quote_send','sent');
 r:=jsonb_build_object('code','OK','version',p_expected_version+1); insert into public.idempotency_keys(workspace_id,actor_id,operation,key,request_hash,response_status,response_body) values(p_workspace_id,auth.uid(),'register_quote_send',p_idempotency_key,coalesce(p_request_id,''),200,r); return r; end; $$;
revoke all on function public.register_quote_send_with_next_action(uuid,uuid,bigint,text,text,timestamptz,text,jsonb,text,text,text) from public;
grant execute on function public.register_quote_send_with_next_action(uuid,uuid,bigint,text,text,timestamptz,text,jsonb,text,text,text) to authenticated;
