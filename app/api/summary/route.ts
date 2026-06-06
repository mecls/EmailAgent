import { requireAccountId } from '@/lib/auth/session'
import { inboxSummary } from '@/lib/commands/inbox-summary'

// Node runtime (service-role + LLM). Generous duration for the summary call.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Runs the structured inbox summary for the verified caller. The account id is
 * re-derived from the session — never taken from the client — so the scan is
 * always scoped to the caller's own mail. Returns JSON; the UI shows a loading
 * state while it resolves.
 */
export async function POST() {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  try {
    const summary = await inboxSummary(accountId)
    return Response.json(summary)
  } catch (e) {
    console.error('[summary] failed', e)
    return new Response('summary_error', { status: 500 })
  }
}
