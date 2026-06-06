-- 0009 — Switch embeddings from Voyage (1024-dim) to Supabase gte-small (384-dim)
--
-- Embeddings are produced by a Supabase Edge Function (Supabase.ai gte-small),
-- which outputs 384-dim vectors. The `embeddings` table is empty (Voyage never
-- succeeded), so dropping + re-adding the column is lossless. Idempotent + safe to
-- run on an already-migrated DB (the fix) and on a fresh one (0005/0006 already
-- create these at 384; this just reasserts them).

-- 1. Re-shape the vector column + HNSW index to 384-dim ------------------------
drop index if exists embeddings_hnsw_idx;
alter table public.embeddings drop column if exists embedding;
alter table public.embeddings add column embedding vector(384);
create index embeddings_hnsw_idx on public.embeddings
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- 2. Recreate the search function with a 384-dim query param -------------------
create or replace function public.search_embeddings(
  p_account_id uuid,
  p_query      vector(384),
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

notify pgrst, 'reload schema';
