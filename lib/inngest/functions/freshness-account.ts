import { inngest } from '../client'
import { getAccessToken } from '@/lib/google/oauth'
import { listHistory, HistoryExpiredError } from '@/lib/google/gmail'
import { ReconnectRequiredError } from '@/lib/google/errors'
import { getHistoryId, setHistoryId } from '@/lib/db/credentials'

/**
 * Incremental sync for one account via users.history.list from the stored
 * cursor. On a 404 (expired historyId) → full resync. New message ids are fanned
 * out as `index.batch` events WITHOUT `drain` (they aren't part of a full-sync
 * count, so they must not trigger a finalize/first-brief).
 */
export const freshnessAccount = inngest.createFunction(
  {
    id: 'freshness-account',
    concurrency: { key: 'event.data.accountId', limit: 1 },
    retries: 2,
  },
  { event: 'freshness.account' },
  async ({ event, step }) => {
    const { accountId } = event.data

    const outcome: { resync: boolean; ids: string[] } = await step.run(
      'poll',
      async () => {
        const startHistoryId = await getHistoryId(accountId)
        if (!startHistoryId) return { resync: false, ids: [] }

        let token: string
        try {
          token = await getAccessToken(accountId)
        } catch (e) {
          if (e instanceof ReconnectRequiredError) return { resync: false, ids: [] }
          throw e
        }

        try {
          const { added, historyId } = await listHistory(token, startHistoryId)
          if (historyId) await setHistoryId(accountId, historyId)
          return { resync: false, ids: added.map((a) => a.id) }
        } catch (e) {
          if (e instanceof HistoryExpiredError) return { resync: true, ids: [] }
          throw e
        }
      },
    )

    if (outcome.resync) {
      await step.sendEvent('resync', {
        name: 'index.kickoff',
        data: { accountId, sinceDays: 90 },
      })
      return { accountId, resync: true }
    }

    if (outcome.ids.length > 0) {
      const events = []
      for (let i = 0; i < outcome.ids.length; i += 50) {
        events.push({
          name: 'index.batch' as const,
          data: { accountId, ids: outcome.ids.slice(i, i + 50) }, // no drain
        })
      }
      await step.sendEvent('fanout-fresh', events)
    }

    return { accountId, added: outcome.ids.length }
  },
)
