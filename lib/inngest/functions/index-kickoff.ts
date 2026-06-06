import { inngest } from '../client'
import { getAccessToken } from '@/lib/google/oauth'
import { listMessageIds, getProfileHistoryId } from '@/lib/google/gmail'
import { setHistoryId } from '@/lib/db/credentials'
import {
  setSyncPhase,
  resetIndexProgress,
  addPendingMessages,
  finishListing,
  markSyncReady,
} from '@/lib/db/sync'

/**
 * How far back the background index reaches. Indexing is entirely off the critical
 * path now: setup feels instant and the agent answers from live Gmail search
 * (lib/agent/live-search.ts) while this runs. So we index a full year for strong
 * semantic recall + briefs once it completes; older mail stays reachable live.
 */
export const INDEX_WINDOW_DAYS = 365

/** Gmail uses `after:YYYY/MM/DD` (NOT newer_than). UTC date, N days back. */
function afterQuery(sinceDays: number): string {
  const d = new Date(Date.now() - sinceDays * 86_400_000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `after:${y}/${m}/${day} -in:chats`
}

/**
 * Start a full index for an account. Lists message ids page by page, counts them
 * into the drain counter, and fans out one `index.page` per page. When listing
 * finishes (and if everything already drained), marks the account ready and
 * enqueues the first brief.
 */
export const indexKickoff = inngest.createFunction(
  {
    id: 'index-kickoff',
    concurrency: { key: 'event.data.accountId', limit: 1 },
    retries: 3,
    onFailure: async ({ event, error }) => {
      const accountId = (event.data.event.data as { accountId: string }).accountId
      const message = error instanceof Error ? error.message : String(error)
      try {
        await setSyncPhase(accountId, 'error', message)
      } catch (e) {
        console.error('[index-kickoff] setSyncPhase(error) failed', e)
      }
    },
  },
  { event: 'index.kickoff' },
  async ({ event, step }) => {
    const { accountId } = event.data
    // Index only the recent window for fast setup; older correspondence is reached
    // via live Gmail search at query time. Callers (e.g. a manual re-index) may widen.
    const sinceDays = event.data.sinceDays ?? INDEX_WINDOW_DAYS
    const query = afterQuery(sinceDays)

    await step.run('begin', async () => {
      await setSyncPhase(accountId, 'indexing')
      await resetIndexProgress(accountId)
    })

    await step.run('baseline-history', async () => {
      const token = await getAccessToken(accountId)
      const historyId = await getProfileHistoryId(token)
      await setHistoryId(accountId, historyId)
    })

    let pageToken: string | undefined
    let page = 0
    for (;;) {
      const result: { ids: string[]; next: string | null } = await step.run(
        `list-page-${page}`,
        async () => {
          const token = await getAccessToken(accountId)
          const { ids, nextPageToken } = await listMessageIds(token, {
            query,
            pageToken,
            maxResults: 500,
          })
          return { ids: ids.map((r) => r.id), next: nextPageToken ?? null }
        },
      )

      if (result.ids.length > 0) {
        await step.run(`count-page-${page}`, async () => {
          await addPendingMessages(accountId, result.ids.length)
          return result.ids.length
        })
        await step.sendEvent(`fanout-page-${page}`, {
          name: 'index.page',
          data: { accountId, ids: result.ids, drain: true },
        })
      }

      if (!result.next) break
      pageToken = result.next
      page++
    }

    const remaining = await step.run('finish-listing', () =>
      finishListing(accountId),
    )
    if (remaining <= 0) {
      await step.run('finalize-ready', () => markSyncReady(accountId))
      await step.sendEvent('first-brief', {
        name: 'brief.generate',
        data: { accountId },
      })
    }

    return { accountId, pages: page + 1 }
  },
)
