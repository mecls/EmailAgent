import { supabaseService } from '@/lib/supabase/service'

export interface GoogleCredentialsRow {
  account_id: string
  google_sub: string | null
  email: string | null
  refresh_secret_id: string
  scope: string | null
  history_id: string | null
  watch_expires_at: string | null
  updated_at: string
}

export interface GoogleCredentialsUpsert {
  accountId: string
  googleSub?: string | null
  email?: string | null
  refreshSecretId: string
  scope?: string | null
}

/** Upsert the credential metadata row (the token lives in Vault, not here). */
export async function upsertGoogleCredentials(
  c: GoogleCredentialsUpsert,
): Promise<void> {
  const { error } = await supabaseService()
    .from('google_credentials')
    .upsert(
      {
        account_id: c.accountId,
        google_sub: c.googleSub ?? null,
        email: c.email ?? null,
        refresh_secret_id: c.refreshSecretId,
        scope: c.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    )
  if (error) throw new Error(`upsertGoogleCredentials failed: ${error.message}`)
}

export async function getGoogleCredentials(
  accountId: string,
): Promise<GoogleCredentialsRow | null> {
  const { data, error } = await supabaseService()
    .from('google_credentials')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw new Error(`getGoogleCredentials failed: ${error.message}`)
  return (data as GoogleCredentialsRow | null) ?? null
}

export async function hasGoogleCredentials(accountId: string): Promise<boolean> {
  const { data, error } = await supabaseService()
    .from('google_credentials')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw new Error(`hasGoogleCredentials failed: ${error.message}`)
  return Boolean(data)
}

/** Gmail incremental sync cursor (used by the freshness poll in M3). */
export async function getHistoryId(accountId: string): Promise<string | null> {
  const row = await getGoogleCredentials(accountId)
  return row?.history_id ?? null
}

export async function setHistoryId(
  accountId: string,
  historyId: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from('google_credentials')
    .update({ history_id: historyId, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
  if (error) throw new Error(`setHistoryId failed: ${error.message}`)
}
