import { inngest } from '../client'

/**
 * Split a page of message ids (≤500) into ≤50-id batches and fan them out. The
 * batch arrays stay far under Inngest's 5,000-events-per-sendEvent cap, but we
 * chunk the sendEvent array defensively anyway. `drain` is forwarded so batches
 * from a full sync decrement the drain counter (freshness deltas don't).
 */
export const indexPage = inngest.createFunction(
  {
    id: 'index-page',
    concurrency: { key: 'event.data.accountId', limit: 5 },
    retries: 3,
  },
  { event: 'index.page' },
  async ({ event, step }) => {
    const { accountId, ids, drain } = event.data

    const events = []
    for (let i = 0; i < ids.length; i += 50) {
      events.push({
        name: 'index.batch' as const,
        data: { accountId, ids: ids.slice(i, i + 50), drain },
      })
    }

    // Send in chunks of 5,000 events max.
    for (let i = 0; i < events.length; i += 5000) {
      await step.sendEvent(`fanout-batches-${i}`, events.slice(i, i + 5000))
    }

    return { accountId, batches: events.length }
  },
)
