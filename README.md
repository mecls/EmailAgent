# EmailAgent

A read-only, multi-tenant Gmail assistant. Clients sign in with Google, grant
`gmail.readonly`, a background worker indexes the last 90 days, and a two-tool
LLM agent answers questions and ships a daily **morning brief**. It never sends
or modifies mail — read-only scope and no action tools are the core safety
property.

> Built per `../miraside/docs/email-agent-build-strategy.md`. `miraside` is a
> reference for patterns only — **never** a runtime dependency. This product has
> its own Supabase project, Google OAuth client, and deploy.

## Stack

Next.js 16 (App Router, React 19, TS strict, Tailwind v4) · Supabase (Postgres +
Auth + pgvector + Vault + RLS) · Inngest (durable jobs + crons) · OpenAI-compatible
LLM (Ollama Cloud, via `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` — model must
support tool calling) for the agent loop + brief · Supabase `embed` Edge Function
(gte-small, 384-dim embeddings) · Resend (brief email).

## Architecture (short)

- **Client** is thin: Google sign-in, Gmail connect, a chat box, a brief feed.
  Reads tenant data through Supabase RLS (user JWT). Calls a server-side agent
  route for chat.
- **Supabase** is the source of truth: Auth, Postgres (RLS per `account_id`),
  pgvector, Vault (the encrypted Gmail refresh token).
- **Inngest** is the worker + scheduler: `index.kickoff → page → batch →
  derive-status`, plus `freshness.poll`, `brief.scheduler → brief.generate`, and
  token refresh. Every job is account-scoped and uses the service-role key, so it
  filters by `account_id` itself (RLS is bypassed).
- **Index-light**: store metadata + snippet + embeddings; `body_text` stays NULL
  and is re-fetched from Gmail on demand (smallest breach blast radius).

## Layout

```
app/          routes: login, connect, app (chat + brief feed), auth/callback, api/{inngest,agent}
lib/
  supabase/   browser / server / proxy / service-role clients
  auth/       session helpers + idempotent account provisioning
  vault.ts    store/read the Gmail refresh token via SECURITY DEFINER rpc
  google/     oauth (refresh + invalid_grant), token-cache, gmail REST
  embeddings.ts  gte-small embeddings via the Supabase `embed` Edge Function
  agent/      multi-turn tool loop + 2 read tools + system prompt
  commands/   morning brief · catch me up · who's waiting
  db/         service-role table accessors (always .eq('account_id', …))
  inngest/    client + functions
supabase/functions/embed/  Deno Edge Function: Supabase.ai gte-small (384-dim)
supabase/migrations/  schema + RLS + SECURITY DEFINER helpers + vector search fn
emails/       morning-brief React Email template
components/app/  primitives + chat UI
```

## Getting started

See **[SETUP.md](./SETUP.md)** for provisioning (Supabase, Google, Inngest,
Anthropic/Voyage/Resend, Vercel) and the per-milestone verification checklist.

```bash
npm install
cp .env.example .env.local   # fill values per SETUP.md
npm run dev
```
