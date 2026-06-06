-- 0007 — Briefs (the daily morning brief feed)

create table public.briefs (
  id           bigserial primary key,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  generated_at timestamptz not null default now(),
  since        timestamptz,
  items        jsonb not null,             -- [{ group, line }] grouped Leads/Clients/Ops/To-sign
  delivered    boolean not null default false
);
create index briefs_account_generated_idx on public.briefs(account_id, generated_at desc);

alter table public.briefs enable row level security;

create policy tenant_read on public.briefs
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
