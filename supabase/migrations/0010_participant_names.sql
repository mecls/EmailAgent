-- 0010 — Participant display names + name-aware semantic search
--
-- Problem this fixes: a "catch me up on <person>" query never worked by name.
--   1. Ingest discarded display names — parseAddress kept only the bare lowercase
--      email, so "Miguel Rolo <m.rolo@x.com>" was stored as "m.rolo@x.com" and the
--      name "Miguel Rolo" existed nowhere in the DB.
--   2. The search_embeddings sender filter only matched `from_addr ilike %term%`,
--      so passing a human name (or filtering by a recipient) returned ZERO rows.
--
-- This migration:
--   * adds messages.from_name + messages.to_names (parallel to to_addrs),
--   * recreates search_embeddings so its participant filter matches a name OR an
--     email, across the sender AND the recipients, and returns from_name so the
--     agent can cite the person by name.
--
-- Adding the columns is non-destructive; existing rows get NULL until re-indexed.
-- A full re-index (index.kickoff) repopulates from_name/to_names and rebuilds the
-- embeddings with the new From/To/Subject identity header.

-- 1. New participant-name columns --------------------------------------------
alter table public.messages add column if not exists from_name text;
alter table public.messages add column if not exists to_names text[];

-- 2. Recreate search_embeddings (return signature changes, so DROP first) ------
drop function if exists public.search_embeddings(uuid, vector, int, text, timestamptz);

create function public.search_embeddings(
  p_account_id uuid,
  p_query      vector(384),
  p_limit      int default 10,
  p_sender     text default null,   -- now: participant name OR email (from or to)
  p_since      timestamptz default null
)
returns table (
  gmail_id  text,
  subject   text,
  from_addr text,
  from_name text,
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
    select m.gmail_id, m.subject, m.from_addr, m.from_name, m.sent_at, m.snippet,
           (e.embedding <=> p_query) as dist
    from public.embeddings e
    join public.messages m on m.id = e.message_id
    where e.account_id = p_account_id
      and (
        p_sender is null
        or m.from_addr ilike '%' || p_sender || '%'
        or m.from_name ilike '%' || p_sender || '%'
        or exists (
          select 1 from unnest(coalesce(m.to_addrs, '{}'::text[])) a
          where a ilike '%' || p_sender || '%'
        )
        or exists (
          select 1 from unnest(coalesce(m.to_names, '{}'::text[])) n
          where n ilike '%' || p_sender || '%'
        )
      )
      and (p_since is null or m.sent_at >= p_since)
    order by e.embedding <=> p_query
    limit greatest(p_limit * 4, 20)
  ),
  best as (
    select distinct on (gmail_id)
           gmail_id, subject, from_addr, from_name, sent_at, snippet, dist
    from candidates
    order by gmail_id, dist
  )
  select b.gmail_id, b.subject, b.from_addr, b.from_name, b.sent_at, b.snippet,
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

notify pgrst, 'reload schema';
