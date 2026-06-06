/**
 * Typed environment access.
 *
 * Server-only secrets are read lazily through getters that throw a clear error
 * when missing — so a missing key surfaces at the call site, not as a cryptic
 * `undefined` deep inside an SDK. Public (browser-exposed) values are referenced
 * via their literal `process.env.NEXT_PUBLIC_*` names so Next can inline them at
 * build time.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return v
}

/** Public Supabase config — safe to ship to the browser. */
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const env = {
  // Supabase (service-role — server only, never expose)
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  // Google OAuth (the worker refreshes access tokens itself)
  googleClientId: () => required('GOOGLE_OAUTH_CLIENT_ID'),
  googleClientSecret: () => required('GOOGLE_OAUTH_CLIENT_SECRET'),

  // LLM — OpenAI-compatible Chat Completions (Ollama Cloud). Used for the agent
  // loop + brief composition. The model MUST support tool/function calling.
  llmApiKey: () => required('LLM_API_KEY'),
  llmBaseUrl: () => required('LLM_BASE_URL'),
  llmModel: () => required('LLM_MODEL'),
  llmMaxTokens: () => {
    const raw = process.env.LLM_MAX_TOKENS
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2048
  },

  // Embeddings run on the Supabase `embed` Edge Function (gte-small) using the
  // service-role key + SUPABASE_URL above — no dedicated embeddings env needed.

  // Resend (brief delivery + ops alerts)
  resendApiKey: () => required('RESEND_API_KEY'),
  briefFromEmail: () => required('BRIEF_FROM_EMAIL'),
  opsAlertEmail: () => process.env.OPS_ALERT_EMAIL ?? '',

  // App. Used to build the OAuth redirect (redirectTo). Precedence:
  //  1. APP_BASE_URL — set this explicitly in prod (must match the URL allow-
  //     listed in Supabase Auth and stay stable across deploys).
  //  2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's stable production domain, auto-
  //     injected, so a deploy without an explicit APP_BASE_URL still works.
  //  3. localhost — local dev fallback.
  appBaseUrl: () => {
    const explicit = process.env.APP_BASE_URL
    if (explicit) return explicit.replace(/\/$/, '')
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (vercel) return `https://${vercel}`
    return 'http://localhost:3000'
  },
} as const
