-- 0005 — Mail index: messages, threads, embeddings + RLS
--
-- Index-light: messages store snippet + metadata; body_text stays NULL (the full
-- body is re-fetched from Gmail on demand). Embeddings capture semantic content
-- at index time. Everything is account-scoped; the worker filters by account_id
-- (RLS is bypassed by the service role) and clients read via RLS.

create table public.messages (
  id           bigserial primary key,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  gmail_id     text not null,
  thread_id    text not null,
  from_addr    text,
  to_addrs     text[],
  sent_at      timestamptz,
  subject      text,
  snippet      text,                       -- stored
  body_text    text,                       -- NULL by default (index-light)
  direction    text,                       -- inbound | outbound
  is_automated boolean not null default false,
  labels       text[],
  created_at   timestamptz not null default now(),
  unique (account_id, gmail_id)
);
create index messages_account_sent_idx   on public.messages(account_id, sent_at desc);
create index messages_account_thread_idx on public.messages(account_id, thread_id);

create table public.threads (
  account_id      uuid not null references public.accounts(id) on delete cascade,
  thread_id       text not null,
  subject         text,
  last_message_at timestamptz,
  last_direction  text,
  status          text,                    -- awaiting_us | awaiting_them | closed
  summary         text,                    -- optional, async (later)
  primary key (account_id, thread_id)
);
create index threads_account_status_idx on public.threads(account_id, status, last_message_at desc);

create table public.embeddings (
  account_id uuid not null references public.accounts(id) on delete cascade,
  message_id bigint not null references public.messages(id) on delete cascade,
  chunk_idx  int  not null,
  content    text,
  embedding  vector(384),                  -- Supabase gte-small dims
  primary key (message_id, chunk_idx)
);
create index embeddings_hnsw_idx on public.embeddings
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);
create index embeddings_account_idx on public.embeddings(account_id);

-- RLS ------------------------------------------------------------------------
alter table public.messages   enable row level security;
alter table public.threads    enable row level security;
alter table public.embeddings enable row level security;

create policy tenant_read on public.messages
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.threads
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.embeddings
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
