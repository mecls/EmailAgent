import type { User } from '@supabase/supabase-js'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Idempotently provision an account for a first-time user: an `accounts` row, an
 * owner `account_members` row, and default `config` (timezone, brief_time,
 * owner_email). Returns the account id. Safe to call on every login.
 */
export async function provisionAccount(user: User): Promise<string> {
  const email = user.email
  if (!email) throw new Error('provisionAccount: user has no email')

  const svc = supabaseService()

  // Already provisioned?
  const { data: existing, error: existingErr } = await svc
    .from('account_members')
    .select('account_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (existingErr) {
    throw new Error(`provisionAccount lookup failed: ${existingErr.message}`)
  }
  if (existing?.account_id) return existing.account_id as string

  // Create the account.
  const { data: account, error: accountErr } = await svc
    .from('accounts')
    .insert({ owner_email: email })
    .select('id')
    .single()
  if (accountErr || !account) {
    throw new Error(`provisionAccount create failed: ${accountErr?.message ?? 'no data'}`)
  }
  const accountId = account.id as string

  const { error: memberErr } = await svc
    .from('account_members')
    .insert({ account_id: accountId, user_id: user.id, role: 'owner' })
  if (memberErr) {
    throw new Error(`provisionAccount member failed: ${memberErr.message}`)
  }

  const { error: configErr } = await svc.from('config').upsert(
    [
      { account_id: accountId, key: 'timezone', value: 'UTC' },
      { account_id: accountId, key: 'brief_time', value: '08:00' },
      { account_id: accountId, key: 'owner_email', value: email },
    ],
    { onConflict: 'account_id,key' },
  )
  if (configErr) {
    throw new Error(`provisionAccount config failed: ${configErr.message}`)
  }

  return accountId
}
