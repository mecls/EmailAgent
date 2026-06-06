import { requireAccountId } from '@/lib/auth/session'
import { getSyncState } from '@/lib/db/sync'

export const runtime = 'nodejs'

/**
 * Lightweight, account-scoped sync snapshot. Polled by the silent ready-watcher
 * (components/app/inbox/sync-banner.tsx) so the app can refresh once background
 * indexing finishes; the drain counter/listing flag are kept for diagnostics.
 */
export async function GET() {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  const s = await getSyncState(accountId)
  return Response.json({
    phase: s?.phase ?? 'pending',
    pending: s?.pending_messages ?? 0,
    listingComplete: s?.listing_complete ?? false,
    lastError: s?.last_error ?? null,
  })
}
