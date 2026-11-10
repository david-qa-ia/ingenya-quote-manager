-- Stage 3: branding of the quote PDF per workspace (SaaS). Each company that uses the app saves its
-- logo (PNG or JPEG data URL, already reduced in the browser) and its brand color in
-- Configuración > Datos de la empresa. Additive only: two columns with empty defaults and the
-- same RPC signature; existing rows and older clients keep working.

alter table public.workspace_company_profiles
  add column if not exists logo_data_url text not null default ''
    check (length(logo_data_url) <= 300000
      and (logo_data_url = '' or logo_data_url ~ '^data:image/(png|jpeg);base64,')),
  add column if not exists brand_color text not null default ''
    check (brand_color = '' or brand_color ~ '^#[0-9A-F]{6}$');

-- p_profile: {"companyName","tagline","email","whatsapp","website","instagram","footerText",
-- "quoteValidityDays","logoDataUrl","brandColor"}. p_expected_version is null for the first save.
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
  v_logo text;
  v_color text;
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

  -- A client that does not send the logo or the color (older app version) keeps the stored ones.
  v_logo := coalesce(p_profile->>'logoDataUrl', current_row.logo_data_url, '');
  v_color := upper(btrim(coalesce(p_profile->>'brandColor', current_row.brand_color, '')));
  if v_logo <> '' and (length(v_logo) > 300000
      or v_logo !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$') then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'El logo tiene que ser una imagen PNG o JPG de hasta 220 KB.');
  end if;
  if v_color <> '' and v_color !~ '^#[0-9A-F]{6}$' then
    return jsonb_build_object('code', 'VALIDATION', 'message', 'Ingresá un color como #2F6BFF.');
  end if;

  insert into public.workspace_company_profiles as profile (
    workspace_id, company_name, tagline, email, whatsapp, website, instagram, footer_text,
    quote_validity_days, logo_data_url, brand_color
  ) values (
    p_workspace_id,
    btrim(p_profile->>'companyName'),
    left(btrim(coalesce(p_profile->>'tagline', '')), 120),
    left(btrim(coalesce(p_profile->>'email', '')), 160),
    left(btrim(coalesce(p_profile->>'whatsapp', '')), 40),
    left(btrim(coalesce(p_profile->>'website', '')), 160),
    left(btrim(coalesce(p_profile->>'instagram', '')), 120),
    left(btrim(coalesce(p_profile->>'footerText', '')), 160),
    v_days,
    v_logo,
    v_color
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
        logo_data_url = excluded.logo_data_url,
        brand_color = excluded.brand_color,
        version = profile.version + 1,
        updated_at = now()
  returning * into saved_row;

  response := jsonb_build_object('code', 'OK', 'version', saved_row.version, 'idempotent', false);
  insert into public.audit_events (workspace_id, actor_id, operation, entity_type, entity_id, request_id, idempotency_key, before_state, after_state, result)
    values (p_workspace_id, auth.uid(), case when current_row.workspace_id is null then 'create' else 'update' end,
      'workspace_company_profile', p_workspace_id, p_request_id, p_idempotency_key,
      -- The audit keeps whether there is a logo, not the image itself.
      case when current_row.workspace_id is null then null
        else (to_jsonb(current_row) - 'logo_data_url')
          || jsonb_build_object('has_logo', current_row.logo_data_url <> '') end,
      (to_jsonb(saved_row) - 'logo_data_url')
        || jsonb_build_object('has_logo', saved_row.logo_data_url <> ''), 'success');
  insert into public.idempotency_keys (workspace_id, actor_id, operation, key, request_hash, response_status, response_body)
    values (p_workspace_id, auth.uid(), 'save_workspace_company_profile', p_idempotency_key,
      coalesce(p_request_id, ''), 200, response);
  return response;
end;
$$;

revoke all on function public.save_workspace_company_profile(uuid, bigint, jsonb, text, text) from public;
grant execute on function public.save_workspace_company_profile(uuid, bigint, jsonb, text, text) to authenticated;
