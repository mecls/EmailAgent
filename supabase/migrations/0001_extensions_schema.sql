-- 0001 — Extensions + app schema
--
-- Run order: this is the first migration. `vector` powers pgvector embeddings;
-- the `app` schema holds SECURITY DEFINER helpers (RLS tenancy helper, Vault
-- wrappers, vector search) that must NOT be reachable over PostgREST.
--
-- The `vault` extension is enabled separately from the Supabase dashboard
-- (Database → Extensions, or Integrations → Vault) — see SETUP.md. It cannot
-- always be created via plain SQL depending on project setup.

create extension if not exists vector;

create schema if not exists app;

-- Lock the app schema down: only the service role (worker) and the SQL of our
-- own SECURITY DEFINER functions touch it. Individual function grants are made
-- in their own migrations.
revoke all on schema app from public;
grant usage on schema app to service_role;
