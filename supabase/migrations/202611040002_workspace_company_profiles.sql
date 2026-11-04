-- SCRUM-119: the company data printed on quotes (name, contact, footer, validity), one row per
-- workspace. Ventro fills in its own; another company that gets the app fills in theirs from
-- Configuración > Datos de la empresa. Read with RLS (owner/admin); written only through
-- save_workspace_company_profile, with expected version, idempotency and audit.

create table if not exists public.workspace_company_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  company_name text not null check (length(btrim(company_name)) between 1 and 120),
  tagline text not null default '' check (length(tagline) <= 120),
  email text not null default '' check (length(email) <= 160),
  whatsapp text not null default '' check (length(whatsapp) <= 40),
  website text not null default '' check (length(website) <= 160),
  instagram text not null default '' check (length(instagram) <= 120),
  footer_text text not null default '' check (length(footer_text) <= 160),
  quote_validity_days integer not null default 15 check (quote_validity_days between 1 and 365),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_company_profiles enable row level security;

drop policy if exists workspace_company_profiles_workspace_isolation on public.workspace_company_profiles;
create policy workspace_company_profiles_workspace_isolation
  on public.workspace_company_profiles for select
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

grant select on public.workspace_company_profiles to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.workspace_company_profiles from anon, authenticated;

-- p_profile: {"companyName","tagline","email","whatsapp","website","instagram","footerText",
-- "quoteValidityDays"}. p_expected_version is null for the first save.
create or replace function public.save_workspace_company_profile(
  p_workspace_id uuid,
  p_expected_version bigint,
  p_profile jsonb,
  p_idempotency_key text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.workspace_company_profiles%rowtype;
  saved_row public.workspace_company_profiles%rowtype;
  response jsonb;
  v_days integer;
begin
  perform public.assert_commercial_rpc_access(p_workspace_id);
  select response_body into response
  from public.idempotency_keys
  where workspace_id = p_workspace_id and actor_id = auth.uid()
    and operation = 'save_workspace_company_profile' and key = p_idempotency_key;
  if response is not null then return response; end if;

  if jsonb_typeof(p_profile) is distinct from 'object'
    or length(btrim(coalesce(p_profile->>'companyName', ''))) not between 1 and 120 then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Ingresá el nombre de la empresa.');
  end if;
  begin
    v_days := coalesce((p_profile->>'quoteValidityDays')::integer, 15);
  exception when others then
    v_days := null;
  end;
  if v_days is null or v_days not between 1 and 365 then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Elegí una validez de 1 a 365 días.');
  end if;

  select * into current_row from public.workspace_company_profiles
    where workspace_id = p_workspace_id for update;
  if coalesce(p_expected_version, 0) <> coalesce(current_row.version, 0) then
    return jsonb_build_object('code', 'CONFLICT', 'version', coalesce(current_row.version, 0));
  end if;

  insert into public.workspace_company_profiles as profile (
    workspace_id, company_name, tagline, email, whatsapp, website, instagram, footer_text,
    quote_validity_days
  ) values (
    p_workspace_id,
    btrim(p_profile->>'companyName'),
    left(btrim(coalesce(p_profile->>'tagline', '')), 120),
    left(btrim(coalesce(p_profile->>'email', '')), 160),
    left(btrim(coalesce(p_profile->>'whatsapp', '')), 40),
    left(btrim(coalesce(p_profile->>'website', '')), 160),
    left(btrim(coalesce(p_profile->>'instagram', '')), 120),
    left(btrim(coalesce(p_profile->>'footerText', '')), 160),
    v_days
  )
  on conflict (workspace_id) do update
    set company_name = excluded.company_name,
        tagline = excluded.tagline,
        email = excluded.email,
        whatsapp = excluded.whatsapp,
        website = excluded.website,
        instagram = excluded.instagram,
        footer_text = excluded.footer_text,
        quote_validity_days = excluded.quote_validity_days,
        version = profile.version + 1,
        updated_at = now()
  returning * into saved_row;

  response := jsonb_build_object('code', 'OK', 'version', saved_row.version, 'idempotent', false);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), case when current_row.workspace_id is null then 'create' else 'update' end,
      'workspace_company_profile', p_workspace_id, p_request_id, p_idempotency_key,
      case when current_row.workspace_id is null then null else to_jsonb(current_row) end,
      to_jsonb(saved_row), 'success');
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'save_workspace_company_profile', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.save_workspace_company_profile(uuid, bigint, jsonb, text, text) from public;
grant execute on function public.save_workspace_company_profile(uuid, bigint, jsonb, text, text) to authenticated;
