# EmailAgent — Setup & Provisioning Runbook

This product runs on an **isolated plane**: its own Supabase project, its own
Google OAuth client, its own Vercel + Inngest apps. Never share infrastructure
with any other product — it ingests entire inboxes.

Work top to bottom. Copy `.env.example` → `.env.local` and fill values as you go.

---

## 1. Supabase project (new)

1. Create a **new** Supabase project (do not reuse another product's).
2. **Database → Extensions**: enable `vector` and `vault`.
3. **SQL Editor**: run every file in `supabase/migrations/` in numeric order
   (`0001` → `0009`). All SECURITY DEFINER functions called over the API live in
   the `public` schema (PostgREST only exposes `public`).
4. **Deploy the embeddings Edge Function** (produces gte-small / 384-dim vectors):
   ```bash
   supabase functions deploy embed   # from the repo root, against this project
   ```
   The worker calls it at `${SUPABASE_URL}/functions/v1/embed` with the
   service-role key, so leave JWT verification on (the default).
5. **Settings → API**: copy
   - Project URL → `SUPABASE_URL` **and** `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. **Authentication → URL Configuration**: add `${APP_BASE_URL}/auth/callback`
   to the redirect allow-list (and your production URL once deployed).

## 2. Google Cloud OAuth client (new)

1. New Google Cloud **project**.
2. **APIs & Services → Enable APIs**: enable the **Gmail API**.
3. **OAuth consent screen**: User type **External**, publishing status
   **Testing**. Scopes: `openid`, `email`, `profile`, and
   `https://www.googleapis.com/auth/gmail.readonly` (**restricted**). Add your
   own Google account(s) under **Test users**.
4. **Credentials → Create OAuth client ID → Web application**. Authorized
   redirect URIs:
   - the **Supabase** auth callback: `https://<project-ref>.supabase.co/auth/v1/callback`
   - the **app** callback: `${APP_BASE_URL}/auth/callback`
5. Copy client id/secret into `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
6. In **Supabase → Authentication → Providers → Google**: enable it and paste the
   same client id/secret.

> ⚠️ **Testing-mode gotcha:** with an External app in Testing requesting a
> *restricted* scope, **refresh tokens expire after 7 days**. Re-consent weekly
> during development. The app detects `invalid_grant` and prompts a reconnect.
> Begin **OAuth verification + CASA Tier 3** before any real-client pilot — it is
> the long pole (2–6 months, ~$4.5–8k/yr). See build-strategy §11.

## 3. Agent LLM (Ollama Cloud) + Resend

- **Agent LLM (OpenAI-compatible)**: the agent loop + brief use an
  OpenAI-compatible Chat Completions endpoint (Ollama Cloud). Set `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL` (optional `LLM_MAX_TOKENS`). **`LLM_MODEL` must
  support tool/function calling** — the agent calls two tools, and the brief uses
  a forced tool (with an automatic fallback to `tool_choice:auto` if the gateway
  rejects forcing). Sign a zero-retention / no-training agreement with the
  provider before ingesting any real inbox.
- **Embeddings**: handled by the Supabase `embed` Edge Function (gte-small,
  384-dim) deployed in §1.4 — no separate provider or key.
- **Resend**: API key → `RESEND_API_KEY`. Verify a sending domain; set
  `BRIEF_FROM_EMAIL` and `OPS_ALERT_EMAIL`.

## 4. Inngest (cloud)

1. Create an Inngest app. Copy `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`.
2. Register the serve endpoint `${APP_BASE_URL}/api/inngest` (Inngest will sync
   the functions, including the `hello` cron).
3. **Local dev**: run `npx inngest-cli dev` and it auto-discovers
   `http://localhost:3000/api/inngest`.

## 5. Vercel

1. New Vercel project linked to this repo.
2. Add every variable from `.env.example` (Production + Preview).
3. The Inngest + agent routes set `maxDuration` via route segment config; ensure
   the plan (Pro / Fluid Compute) allows it.

## 6. Compliance (before any real inbox)

- Sign a **DPA** (you are a data processor).
- Confirm zero-retention/no-training terms with Anthropic + Voyage.
- Start Google **verification + CASA Tier 3**; stay in Testing mode (≤100 users)
  meanwhile.

---

## Local run

```bash
npm install
cp .env.example .env.local   # fill values
npm run dev                  # app at http://localhost:3000
npx inngest-cli dev          # worker, in a second terminal
```

## Verify (per milestone — see build-strategy §14/§15)

- **M0**: `npm run build` clean; service-role `select 1`; `hello` cron appears in Inngest.
- **M1**: Google sign-in → rows in `accounts`+`account_members`; refresh token in
  Vault; `google_credentials` invisible to a logged-in/anon client query; a
  second user sees none of the first's rows.
- **M2**: force-expire the cached access token → next Gmail call auto-refreshes;
  `invalid_grant` → `sync_state.phase='error'` + reconnect prompt.
- **M3**: connect an inbox → `messages`/`embeddings`/`threads` populate in
  minutes; status spot-checks correct; re-run idempotent; `historyId` 404 → resync.
- **M4**: three commands return scoped, automated-filtered results; planted
  prompt-injection email treated as data; account A can't read account B.
- **M4b**: brief row + email at the configured local time; "run now" matches.
- **M5**: full E2E from a fresh Google account.
