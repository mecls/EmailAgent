import { supabaseService } from '@/lib/supabase/service'

/**
 * Store (or rotate) the Google refresh token in Supabase Vault via the
 * SECURITY DEFINER wrapper (0003). Returns the Vault secret id to persist on
 * google_credentials.
 */
export async function storeGoogleRefresh(
  accountId: string,
  token: string,
): Promise<string> {
  const { data, error } = await supabaseService().rpc('store_google_refresh', {
    p_account_id: accountId,
    p_token: token,
  })
  if (error) throw new Error(`storeGoogleRefresh failed: ${error.message}`)
  if (!data) throw new Error('storeGoogleRefresh returned no secret id')
  return data as string
}

/**
 * Decrypt + return the Google refresh token for an account. Service-role only.
 * Throws if none is stored (caller should treat as "reconnect required").
 */
export async function readGoogleRefresh(accountId: string): Promise<string> {
  const { data, error } = await supabaseService().rpc('read_google_refresh', {
    p_account_id: accountId,
  })
  if (error) throw new Error(`readGoogleRefresh failed: ${error.message}`)
  if (!data) throw new Error(`no refresh token stored for account ${accountId}`)
  return data as string
}
