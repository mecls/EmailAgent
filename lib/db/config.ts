import { supabaseService } from '@/lib/supabase/service'

/** Read one config value (jsonb) for an account, or null if unset. */
export async function getConfig<T = unknown>(
  accountId: string,
  key: string,
): Promise<T | null> {
  const { data, error } = await supabaseService()
    .from('config')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`getConfig failed: ${error.message}`)
  return (data?.value as T | undefined) ?? null
}

/** Read all config for an account as a plain object. */
export async function getAllConfig(
  accountId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseService()
    .from('config')
    .select('key, value')
    .eq('account_id', accountId)
  if (error) throw new Error(`getAllConfig failed: ${error.message}`)
  const out: Record<string, unknown> = {}
  for (const row of data ?? []) out[row.key as string] = row.value
  return out
}

export async function setConfig(
  accountId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await supabaseService()
    .from('config')
    .upsert(
      { account_id: accountId, key, value },
      { onConflict: 'account_id,key' },
    )
  if (error) throw new Error(`setConfig failed: ${error.message}`)
}
