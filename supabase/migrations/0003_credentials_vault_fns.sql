-- 0003 — Google credentials + Vault wrappers
--
-- google_credentials is SERVICE-ROLE ONLY (RLS enabled, no policy → invisible to
-- any client JWT). The refresh token itself never lives in this table — it's
-- stored in Supabase Vault; this row holds only the Vault secret id + metadata.
--
-- Vault lives in the `vault` schema, which is NOT exposed over PostgREST, so
-- supabase-js cannot call vault.* directly. We wrap the two operations we need in
-- SECURITY DEFINER functions in `public` (resolvable by .rpc()), executable by
-- the service role only.

create table public.google_credentials (
  account_id        uuid primary key references public.accounts(id) on delete cascade,
  google_sub        text,                 -- Google user id (sub)
  email             text,
  refresh_secret_id uuid not null,        -- → vault.secrets.id
  scope             text,
  history_id        text,                 -- Gmail incremental cursor
  watch_expires_at  timestamptz,          -- Pub/Sub watch renewal (later)
  updated_at        timestamptz not null default now()
);

-- RLS on, no policy → only the service role can read/write.
alter table public.google_credentials enable row level security;

-- Store (or rotate) the refresh token; returns the Vault secret id. Called by the
-- auth callback after capturing provider_refresh_token.
create or replace function public.store_google_refresh(p_account_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select refresh_secret_id into v_id
  from public.google_credentials
  where account_id = p_account_id;

  if v_id is null then
    v_id := vault.create_secret(
      p_token,
      'google_refresh:' || p_account_id::text,
      'gmail refresh token'
    );
  else
    perform vault.update_secret(v_id, p_token);
  end if;

  return v_id;
end;
$$;

-- Decrypt + return the refresh token for an account. Called by the worker before
-- exchanging it for an access token at Google's token endpoint.
create or replace function public.read_google_refresh(p_account_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.google_credentials c
  join vault.decrypted_secrets s on s.id = c.refresh_secret_id
  where c.account_id = p_account_id
$$;

revoke all on function public.store_google_refresh(uuid, text) from public, anon, authenticated;
revoke all on function public.read_google_refresh(uuid)        from public, anon, authenticated;
grant execute on function public.store_google_refresh(uuid, text) to service_role;
grant execute on function public.read_google_refresh(uuid)        to service_role;
