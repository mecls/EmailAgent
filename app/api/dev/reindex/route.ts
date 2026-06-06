import { type NextRequest, NextResponse } from 'next/server'
import { requireAccountId } from '@/lib/auth/session'
import { inngest } from '@/lib/inngest/client'

export const runtime = 'nodejs'

/**
 * DEV-ONLY: re-run a full index for the signed-in account. Use after changing the
 * indexing pipeline (e.g. adding participant display names + the From/To/Subject
 * identity header) so existing messages are rebuilt with the new shape.
 *
 * Re-index is idempotent: messages upsert on (account_id, gmail_id) and each
 * message's embeddings are deleted + rebuilt. Disabled in production.
 *
 *   GET /api/dev/reindex            → full backfill (~10 years)
 *   GET /api/dev/reindex?days=365   → just the last 365 days
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('not found', { status: 404 })
  }

  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const daysParam = new URL(req.url).searchParams.get('days')
  const parsed = daysParam ? parseInt(daysParam, 10) : NaN
  const sinceDays = Number.isFinite(parsed) ? Math.max(1, parsed) : 3650

  await inngest.send({ name: 'index.kickoff', data: { accountId, sinceDays } })
  return NextResponse.json({ ok: true, accountId, sinceDays })
}
