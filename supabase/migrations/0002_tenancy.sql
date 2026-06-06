-- 0002 — Tenancy: accounts, members, per-account config, RLS
--
-- One account per connected inbox (owner = the Google user). RLS scopes every
-- read to the caller's account(s). The worker uses the service-role key and
-- bypasses RLS, so it must filter by account_id itself.

-- Tables ---------------------------------------------------------------------
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  owner_email text not null,
  created_at  timestamptz not null default now()
);

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner',
  primary key (account_id, user_id)
);
create index account_members_user_id_idx on public.account_members(user_id);

-- Per-account config (brief_time, timezone, owner_email, future channels…)
create table public.config (
  account_id uuid not null references public.accounts(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  primary key (account_id, key)
);

-- Tenancy helper -------------------------------------------------------------
-- SECURITY DEFINER so it reads account_members without tripping that table's
-- own RLS (avoids recursion); wraps auth.uid() in a subselect for the ~95% RLS
-- perf win noted in the strategy doc.
create or replace function app.account_ids_for_current_user()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select account_id
  from public.account_members
  where user_id = (select auth.uid())
$$;

revoke all on function app.account_ids_for_current_user() from public, anon;
grant execute on function app.account_ids_for_current_user() to authenticated;
-- authenticated must have USAGE on the `app` schema to resolve the helper from
-- RLS policy expressions (EXECUTE alone is not enough).
grant usage on schema app to authenticated;

-- RLS ------------------------------------------------------------------------
alter table public.accounts        enable row level security;
alter table public.account_members enable row level security;
alter table public.config          enable row level security;

create policy tenant_read on public.accounts
  for select to authenticated
  using (id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.account_members
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.config
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

-- Writes happen exclusively through the service role (provisioning, worker), so
-- no INSERT/UPDATE/DELETE policies are granted to authenticated.
