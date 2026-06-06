import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Service-role Supabase client (server only).
 *
 * Bypasses RLS — so every query made through this client MUST scope by
 * `account_id` itself (see the per-account `.eq('account_id', …)` rule in the
 * build strategy §4). Never import this into client components or expose the
 * key. Used by the Inngest worker, the auth callback, and the agent's
 * server-side tool execution.
 */
let cached: SupabaseClient | null = null

export function supabaseService(): SupabaseClient {
  if (cached) return cached
  cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false },
  })
  return cached
}
