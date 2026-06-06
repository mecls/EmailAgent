-- 0004 — Per-account sync state
--
-- Tracks where each account is in its indexing lifecycle and surfaces errors
-- (notably `error` when the Gmail refresh token is revoked/expired and the user
-- must reconnect). Read by /connect and /app; written by the worker + the token
-- refresh path.

create table public.sync_state (
  account_id        uuid primary key references public.accounts(id) on delete cascade,
  phase             text not null default 'pending',  -- pending | indexing | ready | error
  last_full_sync_at timestamptz,
  last_error        text,
  -- Drain tracking for the fan-out indexer. kickoff counts every message it
  -- enqueues (pending_messages += page size) and flips listing_complete when the
  -- listing finishes; each batch decrements by how many it processed. When the
  -- counter hits 0 *and* listing is complete, the account is `ready`.
  pending_messages  int not null default 0,
  listing_complete  boolean not null default false,
  updated_at        timestamptz not null default now()
);

alter table public.sync_state enable row level security;

create policy tenant_read on public.sync_state
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

-- Atomic drain counters. These live in `public` (NOT `app`) because supabase-js
-- .rpc() only resolves functions in PostgREST's exposed schema (public); they're
-- locked to service_role via the grants below.
create or replace function public.reset_index_progress(p_account_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.sync_state
  set pending_messages = 0, listing_complete = false, updated_at = now()
  where account_id = p_account_id;
$$;

create or replace function public.add_pending_messages(p_account_id uuid, p_n int)
returns void language sql security definer set search_path = '' as $$
  update public.sync_state
  set pending_messages = pending_messages + p_n, updated_at = now()
  where account_id = p_account_id;
$$;

-- Decrement by however many messages a batch processed; return the remainder.
create or replace function public.complete_messages(p_account_id uuid, p_n int)
returns int language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  update public.sync_state
  set pending_messages = greatest(pending_messages - p_n, 0), updated_at = now()
  where account_id = p_account_id
  returning pending_messages into remaining;
  return coalesce(remaining, 0);
end;
$$;

-- Mark listing finished; return the current remainder so the caller can finalize
-- if every batch already drained before listing completed.
create or replace function public.finish_listing(p_account_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  update public.sync_state
  set listing_complete = true, updated_at = now()
  where account_id = p_account_id
  returning pending_messages into remaining;
  return coalesce(remaining, 0);
end;
$$;

revoke all on function public.reset_index_progress(uuid)        from public, anon, authenticated;
revoke all on function public.add_pending_messages(uuid, int)   from public, anon, authenticated;
revoke all on function public.complete_messages(uuid, int)      from public, anon, authenticated;
revoke all on function public.finish_listing(uuid)              from public, anon, authenticated;
grant execute on function public.reset_index_progress(uuid)      to service_role;
grant execute on function public.add_pending_messages(uuid, int) to service_role;
grant execute on function public.complete_messages(uuid, int)    to service_role;
grant execute on function public.finish_listing(uuid)            to service_role;
