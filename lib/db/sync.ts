import { supabaseService } from '@/lib/supabase/service'

export type SyncPhase = 'pending' | 'indexing' | 'ready' | 'error'

export interface SyncStateRow {
  account_id: string
  phase: SyncPhase
  last_full_sync_at: string | null
  last_error: string | null
  pending_messages: number
  listing_complete: boolean
  updated_at: string
}

export async function getSyncState(
  accountId: string,
): Promise<SyncStateRow | null> {
  const { data, error } = await supabaseService()
    .from('sync_state')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw new Error(`getSyncState failed: ${error.message}`)
  return (data as SyncStateRow | null) ?? null
}

export async function setSyncPhase(
  accountId: string,
  phase: SyncPhase,
  lastError: string | null = null,
): Promise<void> {
  const { error } = await supabaseService()
    .from('sync_state')
    .upsert(
      {
        account_id: accountId,
        phase,
        last_error: lastError,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    )
  if (error) throw new Error(`setSyncPhase failed: ${error.message}`)
}

export async function markSyncReady(accountId: string): Promise<void> {
  const { error } = await supabaseService()
    .from('sync_state')
    .upsert(
      {
        account_id: accountId,
        phase: 'ready',
        last_full_sync_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id' },
    )
  if (error) throw new Error(`markSyncReady failed: ${error.message}`)
}

export async function markSyncError(
  accountId: string,
  message: string,
): Promise<void> {
  await setSyncPhase(accountId, 'error', message.slice(0, 2000))
}

// ── Drain counters (fan-out indexer) ─────────────────────────────────────────

export async function resetIndexProgress(accountId: string): Promise<void> {
  const { error } = await supabaseService().rpc('reset_index_progress', {
    p_account_id: accountId,
  })
  if (error) throw new Error(`resetIndexProgress failed: ${error.message}`)
}

export async function addPendingMessages(
  accountId: string,
  n: number,
): Promise<void> {
  const { error } = await supabaseService().rpc('add_pending_messages', {
    p_account_id: accountId,
    p_n: n,
  })
  if (error) throw new Error(`addPendingMessages failed: ${error.message}`)
}

/** Decrement the counter by `n`; returns messages still outstanding. */
export async function completeMessages(
  accountId: string,
  n: number,
): Promise<number> {
  const { data, error } = await supabaseService().rpc('complete_messages', {
    p_account_id: accountId,
    p_n: n,
  })
  if (error) throw new Error(`completeMessages failed: ${error.message}`)
  return (data as number | null) ?? 0
}

/** Mark listing finished; returns messages still outstanding. */
export async function finishListing(accountId: string): Promise<number> {
  const { data, error } = await supabaseService().rpc('finish_listing', {
    p_account_id: accountId,
  })
  if (error) throw new Error(`finishListing failed: ${error.message}`)
  return (data as number | null) ?? 0
}
