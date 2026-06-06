# EmailAgent

A read-only, multi-tenant Gmail assistant. Clients sign in with Google, grant
`gmail.readonly`, a background worker indexes the last 90 days, and a two-tool
LLM agent answers questions and ships a daily **morning brief**. It never sends
or modifies mail — read-only scope and no action tools are the core safety
property.

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


## Getting started

See **[SETUP.md](./SETUP.md)** for provisioning (Supabase, Google, Inngest,
Anthropic/Voyage/Resend, Vercel) and the per-milestone verification checklist.

```bash
npm install
cp .env.example .env.local   # fill values per SETUP.md
npm run dev
```

<img width="590" height="1278" alt="IMG_5229" src="https://github.com/user-attachments/assets/0b12103f-3ec8-423f-843f-443e4b6176b9" />
<img width="1151" height="956" alt="IMG_5226" src="https://github.com/user-attachments/assets/a9638697-333c-4ace-b705-993c24ee6fe8" />
<img width="590" height="1278" alt="IMG_5228" src="https://github.com/user-attachments/assets/92d8aed3-0224-404f-91ca-7c9a1d573042" />
<img width="590" height="1278" alt="IMG_5232" src="https://github.com/user-attachments/assets/6836e9b5-b37e-4672-8ad4-477a3b36219a" />
<img width="590" height="1278" alt="IMG_5230" src="https://github.com/user-attachments/assets/1746a992-9dc8-4a2e-a5d8-227b690b7ba2" />

