-- 0008 — Fix: RPC-called functions must live in `public`, not `app`
--
-- supabase-js `.rpc()` only resolves functions in PostgREST's exposed schema
-- (`public`). The drain counters + vector search were created in `app`, so calls
-- failed with "Could not find the function public.<name> in the schema cache".
-- This migration (re)creates them in `public` (service-role-only) and drops the
-- `app` copies. Also grants `authenticated` USAGE on `app` so the RLS helper
-- `app.account_ids_for_current_user()` resolves from policy expressions.
--
-- Idempotent and safe to run on an already-migrated DB (the fix) and on a fresh
-- one (0002/0004/0006 already create these in public; this just reasserts them).

-- 1. RLS helper schema usage --------------------------------------------------
grant usage on schema app to authenticated;

-- 2. Drain counters in public -------------------------------------------------
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

-- 3. Vector search in public --------------------------------------------------
create or replace function public.search_embeddings(
  p_account_id uuid,
  p_query      vector(1024),
  p_limit      int default 10,
  p_sender     text default null,
  p_since      timestamptz default null
)
returns table (
  gmail_id  text,
  subject   text,
  from_addr text,
  sent_at   timestamptz,
  snippet   text,
  score     float
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  set local hnsw.iterative_scan = relaxed_order;
  set local hnsw.ef_search = 100;

  return query
  with candidates as (
    select m.gmail_id, m.subject, m.from_addr, m.sent_at, m.snippet,
           (e.embedding <=> p_query) as dist
    from public.embeddings e
    join public.messages m on m.id = e.message_id
    where e.account_id = p_account_id
      and (p_sender is null or m.from_addr ilike '%' || p_sender || '%')
      and (p_since  is null or m.sent_at >= p_since)
    order by e.embedding <=> p_query
    limit greatest(p_limit * 4, 20)
  ),
  best as (
    select distinct on (gmail_id)
           gmail_id, subject, from_addr, sent_at, snippet, dist
    from candidates
    order by gmail_id, dist
  )
  select b.gmail_id, b.subject, b.from_addr, b.sent_at, b.snippet,
         (1 - b.dist)::float as score
  from best b
  order by b.dist asc
  limit p_limit;
end;
$$;

revoke all on function public.search_embeddings(uuid, vector, int, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.search_embeddings(uuid, vector, int, text, timestamptz)
  to service_role;

-- 4. Drop the orphaned `app` copies (no-op on a fresh DB) ----------------------
drop function if exists app.reset_index_progress(uuid);
drop function if exists app.add_pending_messages(uuid, int);
drop function if exists app.complete_messages(uuid, int);
drop function if exists app.finish_listing(uuid);
drop function if exists app.search_embeddings(uuid, vector, int, text, timestamptz);

-- 5. Refresh PostgREST's schema cache so the new RPCs are visible immediately.
notify pgrst, 'reload schema';
