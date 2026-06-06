import { requireAccountId } from '@/lib/auth/session'
import { getSyncState } from '@/lib/db/sync'

export const runtime = 'nodejs'

/**
 * Lightweight, account-scoped sync snapshot for the live "Setting up your inbox"
 * banner to poll. Returns the drain counter and listing flag so the client can
 * estimate progress and an ETA without any server-held total.
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
