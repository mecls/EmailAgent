import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

/** The verified logged-in user, or null. Uses getUser() (revalidates token). */
export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** Throws if not authenticated. Use in Route Handlers / Server Actions. */
export async function requireUser(): Promise<User> {
  const user = await getUser()
  if (!user) throw new Error('unauthorized')
  return user
}

/**
 * Resolve the account a user owns/belongs to. Service-role read (account_members
 * is RLS-protected). Returns null if the user has no account yet.
 */
export async function accountForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabaseService()
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`accountForUser failed: ${error.message}`)
  return (data?.account_id as string | undefined) ?? null
}

/**
 * The account_id for the current request's verified user. Throws if
 * unauthenticated or unprovisioned. This is the ONLY source of account scope for
 * the agent + tool layer — never accept an account id from the client.
 */
export async function requireAccountId(): Promise<{ user: User; accountId: string }> {
  const user = await requireUser()
  const accountId = await accountForUser(user.id)
  if (!accountId) throw new Error('no account for user')
  return { user, accountId }
}
